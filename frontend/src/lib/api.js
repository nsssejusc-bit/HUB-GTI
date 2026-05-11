import axios from "axios";

export const api = axios.create({
  baseURL: "/api",
  withCredentials: true, // envia o cookie httpOnly automaticamente
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 403 && err.response?.data?.code === "MUST_CHANGE_PASSWORD") {
      window.location.replace("/trocar-senha");
    }
    return Promise.reject(err);
  }
);
