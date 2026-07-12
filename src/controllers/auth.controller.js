const authService = require('../services/auth.service');

async function signUp(req, res) {
  const { full_name, email, password, phone } = req.body;
  try {
    const result = await authService.signUp({ full_name, email, password, phone });
    res.status(201).json(result);
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
}

async function signIn(req, res) {
  const { email, password } = req.body;
  try {
    const result = await authService.signIn({ email, password });
    res.json(result);
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
}

async function signOut(req, res) {
  const { refresh_token } = req.body;
  await authService.signOut(refresh_token);
  res.status(204).send();
}

async function refreshToken(req, res) {
  const { refresh_token } = req.body;
  try {
    const result = await authService.refresh(refresh_token);
    res.json(result);
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
}

module.exports = { signUp, signIn, signOut, refreshToken };
