import axios from "axios";

const apiBaseUrl = import.meta.env.VITE_API_URL || (
  import.meta.env.PROD
    ? "https://link-snip-backend.vercel.app"
    : "http://127.0.0.1:8000"
);

const api = axios.create({
  baseURL: apiBaseUrl.replace(/\/$/, ""),
  headers: {
    "Content-Type": "application/json",
  },
});

export default api;
