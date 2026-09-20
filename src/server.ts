import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { createApp } from './app.js';

const port = Number(process.env.PORT ?? 3000);

const app = createApp();

app.listen(port, () => {
  console.log(`KiranaX backend listening on http://localhost:${port}`);
});
