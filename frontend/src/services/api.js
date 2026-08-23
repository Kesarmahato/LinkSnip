import axios from "axios";

const api = axios.create({
  baseURL: "https://link-snip-backend.vercel.app",
  headers: {
    "Content-Type": "application/json",
  },
});

export default api;
