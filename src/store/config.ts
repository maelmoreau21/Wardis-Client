export const getServerHost = (): string => {
  const url = localStorage.getItem("wardis-server-url") || "http://localhost:8080";
  try {
    let normalized = url.trim();
    if (!/^https?:\/\//i.test(normalized)) {
      normalized = "http://" + normalized;
    }
    const parsed = new URL(normalized);
    return parsed.hostname;
  } catch (e) {
    return "localhost";
  }
};

export const getApiBase = (): string => {
  const url = localStorage.getItem("wardis-server-url") || "http://localhost:8080";
  let normalized = url.trim();
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = "http://" + normalized;
  }
  try {
    const parsed = new URL(normalized);
    if (!parsed.port) {
      return `${parsed.protocol}//${parsed.hostname}:8080`;
    }
    return normalized;
  } catch (e) {
    return "http://localhost:8080";
  }
};

export const getHlsBaseUrl = (cameraId: string, token: string): string => {
  const host = getServerHost();
  return `http://${host}:8888/${cameraId}/index.m3u8?token=${token}`;
};

export const getWhepBaseUrl = (cameraId: string, token: string): string => {
  const host = getServerHost();
  return `http://${host}:8889/${cameraId}/whep?token=${token}`;
};
