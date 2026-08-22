import { useEffect, useState } from "react";
import api from "./services/api";

function App() {
  const [backendStatus, setBackendStatus] = useState("Checking...");

  useEffect(() => {
    api
      .get("/health")
      .then((response) => {
        if (response.data.status === "healthy") {
          setBackendStatus("Backend connected successfully");
        } else {
          setBackendStatus("Backend connection failed");
        }
      })
      .catch((error) => {
        console.error("Backend error:", error);
        setBackendStatus("Backend connection failed");
      });
  }, []);

  return (
    <div>
      <h1>LinkSnip</h1>
      <p>URL Shortening & Analytics Platform</p>
      <h2>{backendStatus}</h2>
    </div>
  );
}

export default App;