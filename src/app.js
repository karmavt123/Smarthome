require('dotenv').config();

const path = require('path');
const querystring = require('querystring');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const humps = require('humps');
const swaggerUi = require('swagger-ui-express');

const swaggerSpec = require('./config/swagger');
const caseConversion = require('./middlewares/case.middleware');
const healthRoutes = require('./routes/health.routes');
const devicesRoutes = require('./routes/devices.routes');
const homesRoutes = require('./routes/homes.routes');
const roomsRoutes = require('./routes/rooms.routes');
const authRoutes = require('./routes/auth.routes');
const telemetryRoutes = require('./routes/telemetry.routes');
const deviceActionsRoutes = require('./routes/device-actions.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const environmentRoutes = require('./routes/environment.routes');
const simulatorRoutes = require('./routes/simulator.routes');
const alertsRoutes = require('./routes/alerts.routes');
const doorAccessRoutes = require('./routes/door-access.routes');
const voiceCommandsRoutes = require('./routes/voice-commands.routes');
const faceProfilesRoutes = require('./routes/face-profiles.routes');
const eventsRoutes = require('./routes/events.routes');
const errorHandler = require('./middlewares/error.middleware');

const app = express();

// Decamelize query-string keys (homeId -> home_id) at parse time. Express 5's
// req.query is a read-only getter re-derived from req.url on every access, so
// mutating/reassigning it later (as case.middleware.js does for req.body) is a
// silent no-op — this has to happen via the query-parser hook instead.
app.set('query parser', (str) => humps.decamelizeKeys(querystring.parse(str)));

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use('/api', caseConversion);

app.use('/api', healthRoutes);
app.use('/api', devicesRoutes);
app.use('/api', homesRoutes);
app.use('/api', roomsRoutes);
app.use('/api', authRoutes);
app.use('/api', telemetryRoutes);
app.use('/api', deviceActionsRoutes);
app.use('/api', dashboardRoutes);
app.use('/api', environmentRoutes);
app.use('/api', simulatorRoutes);
app.use('/api', alertsRoutes);
app.use('/api', doorAccessRoutes);
app.use('/api', voiceCommandsRoutes);
app.use('/api', faceProfilesRoutes);
app.use('/api', eventsRoutes);

app.use(errorHandler);

module.exports = app;
