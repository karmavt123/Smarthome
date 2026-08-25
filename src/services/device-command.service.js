const crypto = require("crypto");
const prisma = require("../config/prisma");
const HttpError = require("../utils/http-error");
const { requireDevice } = require("./ownership.service");
const { isSimulatedDevice, isDevicePaused } = require("../simulator/state");
const sseService = require("./sse.service");
const mqttService = require("./mqtt.service");

const COMMAND_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ACTIONS_BY_DEVICE_TYPE = {
  light: ["turn_on", "turn_off", "set_color"],
  fan: ["turn_on", "turn_off", "set_speed"],
  door: ["open", "close"],
};

const STATUS_BY_ACTION = {
  turn_on: "on",
  turn_off: "off",
  open: "open",
  close: "closed",
};

function validateAction(device, action, value = null) {
  const supported = ACTIONS_BY_DEVICE_TYPE[device.device_type] || [];
  if (!supported.includes(action)) {
    throw new HttpError(
      400,
      `${action} is not supported for ${device.device_type} devices`,
    );
  }
  if (
    action === "set_speed" &&
    (!Number.isInteger(value) || value < 0 || value > 100)
  ) {
    throw new HttpError(400, "setSpeed value must be an integer from 0 to 100");
  }
  if (
    action === "set_color" &&
    (typeof value !== "string" || !/^#[0-9a-f]{6}$/i.test(value))
  ) {
    throw new HttpError(
      400,
      "setColor value must be a hex color such as #33AAFF",
    );
  }
  if (!["set_speed", "set_color"].includes(action) && value != null) {
    throw new HttpError(400, `${action} does not accept a value`);
  }
}

function sameJson(left, right) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function executionStatus(status) {
  if (status === "executed") return "success";
  if (status === "failed" || status === "expired") return "failed";
  return "pending";
}

function presentCommand(command) {
  if (!command) return command;
  return { ...command, execution_status: executionStatus(command.status) };
}

// status is only ever on/off/open/close; set_speed/set_color also carry the
// underlying number/hex in the separate `value` column instead of encoding it
// into the status string. turn_on/turn_off/open/close have no value of their
// own, so they leave the device's `value` column untouched (e.g. turning a
// light off keeps its last color in `value` for the next turn_on).
function deviceUpdateAfter(command) {
  if (command.action === "set_speed") {
    return {
      status: Number(command.value) === 0 ? "off" : "on",
      value: String(command.value),
    };
  }
  if (command.action === "set_color") {
    return { status: "on", value: String(command.value) };
  }
  return { status: STATUS_BY_ACTION[command.action] };
}

async function finalizeCommand(commandId, status, failureReason = null) {
  const command = await prisma.device_commands.findUnique({
    where: { id: commandId },
  });
  if (!command || ["executed", "failed", "expired"].includes(command.status))
    return command;

  let updatedDevice = null;

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.device_commands.update({
      where: { id: command.id },
      data: {
        status,
        failure_reason: failureReason,
        acknowledged_at: new Date(),
      },
    });

    if (status === "executed") {
      updatedDevice = await tx.devices.update({
        where: { id: command.device_id },
        data: {
          ...deviceUpdateAfter(command),
          last_seen_at: new Date(),
          connection_status: "online",
        },
      });
    }

    await tx.device_actions.create({
      data: {
        device_id: command.device_id,
        user_id: command.user_id,
        action: command.action,
        control_method: command.control_method,
        execution_status: status === "executed" ? "success" : "failed",
        failure_reason: failureReason,
      },
    });
    return updated;
  });

  // Published after the transaction commits, to the user who owns the device
  // (already verified in createDeviceCommand) — a stalled SSE write must not
  // hold the DB transaction open.
  if (updatedDevice) {
    sseService.publish(command.user_id, "device_status", {
      deviceId: updatedDevice.id,
      status: updatedDevice.status,
      value: updatedDevice.value,
      connectionStatus: updatedDevice.connection_status,
      lastSeenAt: updatedDevice.last_seen_at,
    });
  }

  return result;
}

async function processSimulatedCommand(commandId, random = Math.random) {
  const command = await prisma.device_commands.findUnique({
    where: { id: commandId },
    include: { devices: true },
  });
  if (!command || !["pending", "delivered"].includes(command.status))
    return command;

  if (
    command.devices.connection_status !== "online" ||
    isDevicePaused(command.device_id)
  ) {
    return finalizeCommand(command.id, "failed", "Device is offline");
  }

  const configuredFailureRate = Number(
    process.env.SIMULATOR_COMMAND_FAILURE_RATE,
  );
  const failureRate = Math.min(
    Math.max(
      Number.isFinite(configuredFailureRate) ? configuredFailureRate : 0.08,
      0,
    ),
    1,
  );
  if (random() < failureRate) {
    return finalizeCommand(
      command.id,
      "failed",
      "Simulated device rejected the command",
    );
  }

  return finalizeCommand(command.id, "executed");
}

function scheduleSimulatedCommand(commandId) {
  const delay = Math.max(
    Number(process.env.SIMULATOR_COMMAND_DELAY_MS) || 800,
    0,
  );
  const timer = setTimeout(() => {
    processSimulatedCommand(commandId).catch((error) => {
      console.error("Failed to process simulated command:", error);
    });
  }, delay);
  timer.unref?.();
}

async function createDeviceCommand(
  userId,
  deviceId,
  action,
  controlMethod = "app",
  value = null,
  requestedCommandId = null,
) {
  const device = await requireDevice(userId, deviceId);
  validateAction(device, action, value);
  if (requestedCommandId && !COMMAND_ID_PATTERN.test(requestedCommandId)) {
    throw new HttpError(400, "commandId must be a valid UUID");
  }
  const commandId = requestedCommandId || crypto.randomUUID();
  const expiresAt = new Date(
    Date.now() +
      Math.max(Number(process.env.DEVICE_COMMAND_TTL_SECONDS) || 30, 1) * 1000,
  );

  const existing = await prisma.device_commands.findUnique({
    where: { id: commandId },
  });
  if (existing) {
    if (
      existing.user_id !== Number(userId) ||
      existing.device_id !== device.id ||
      existing.action !== action ||
      existing.control_method !== controlMethod ||
      !sameJson(existing.value, value)
    ) {
      throw new HttpError(409, "commandId is already used for another command");
    }
    return { device, action: presentCommand(existing), duplicate: true };
  }

  const command = await prisma.device_commands.create({
    data: {
      id: commandId,
      device_id: device.id,
      user_id: Number(userId),
      action,
      ...(value == null ? {} : { value }),
      control_method: controlMethod,
      expires_at: expiresAt,
    },
  });

  if (isSimulatedDevice(device)) scheduleSimulatedCommand(command.id);
  else mqttService.publishCommand(device, command);
  return { device, action: presentCommand(command), duplicate: false };
}

async function getDeviceAction(userId, actionId) {
  const command = await prisma.device_commands.findFirst({
    where: {
      id: actionId,
      devices: { homes: { user_id: Number(userId) } },
    },
    include: { devices: true },
  });

  if (!command) throw new HttpError(404, "Device command not found");
  return presentCommand(command);
}

async function listDeviceActions(userId, query = {}) {
  const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 200);
  let statusFilter;
  if (query.status === "pending")
    statusFilter = { in: ["pending", "delivered"] };
  else if (query.status === "success") statusFilter = "executed";
  else if (query.status === "failed")
    statusFilter = { in: ["failed", "expired"] };
  else if (query.status) statusFilter = query.status;

  const commands = await prisma.device_commands.findMany({
    where: {
      devices: {
        homes: { user_id: Number(userId) },
        ...(query.home_id ? { home_id: Number(query.home_id) } : {}),
      },
      ...(query.device_id ? { device_id: Number(query.device_id) } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
    },
    include: { devices: true },
    orderBy: { created_at: "desc" },
    take: limit,
  });
  return commands.map(presentCommand);
}

async function expirePendingCommands(referenceTime = new Date()) {
  const pending = await prisma.device_commands.findMany({
    where: {
      status: { in: ["pending", "delivered"] },
      expires_at: { lte: referenceTime },
    },
    select: { id: true },
  });

  for (const command of pending) {
    await finalizeCommand(
      command.id,
      "expired",
      "Command acknowledgement timed out",
    );
  }

  return pending.length;
}

module.exports = {
  ACTIONS_BY_DEVICE_TYPE,
  STATUS_BY_ACTION,
  executionStatus,
  presentCommand,
  sameJson,
  validateAction,
  finalizeCommand,
  processSimulatedCommand,
  createDeviceCommand,
  getDeviceAction,
  listDeviceActions,
  expirePendingCommands,
};
