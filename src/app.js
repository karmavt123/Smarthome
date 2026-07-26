require('dotenv').config();

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');

const swaggerSpec = require('./config/swagger');
const caseConversion = require('./middlewares/case.middleware');
const healthRoutes = require('./routes/health.routes');
const devicesRoutes = require('./routes/devices.routes');
const authRoutes = require('./routes/auth.routes');
const telemetryRoutes = require('./routes/telemetry.routes');
const deviceActionsRoutes = require('./routes/device-actions.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const simulatorRoutes = require('./routes/simulator.routes');
const alertsRoutes = require('./routes/alerts.routes');
const doorAccessRoutes = require('./routes/door-access.routes');
const voiceCommandsRoutes = require('./routes/voice-commands.routes');
const errorHandler = require('./middlewares/error.middleware');

const app = express();

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use('/api', caseConversion);

app.use('/api', healthRoutes);
app.use('/api', devicesRoutes);
app.use('/api', authRoutes);
app.use('/api', telemetryRoutes);
app.use('/api', deviceActionsRoutes);
app.use('/api', dashboardRoutes);
app.use('/api', simulatorRoutes);
app.use('/api', alertsRoutes);
app.use('/api', doorAccessRoutes);
app.use('/api', voiceCommandsRoutes);

app.use(errorHandler);

module.exports = app;
