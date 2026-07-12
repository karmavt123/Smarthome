require('dotenv').config();

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');

const swaggerSpec = require('./config/swagger');
const healthRoutes = require('./routes/health.routes');
const devicesRoutes = require('./routes/devices.routes');
const authRoutes = require('./routes/auth.routes');

const app = express();

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use('/api', healthRoutes);
app.use('/api', devicesRoutes);
app.use('/api', authRoutes);

module.exports = app;
