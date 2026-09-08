// API client for calling the FastAPI backend
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

class APIClient {
  private baseUrl: string;
  private token: string | null = sessionStorage.getItem("auth_token");

  constructor() {
    this.baseUrl = API_BASE;
  }

  setToken(token: string) {
    this.token = token;
    sessionStorage.setItem("auth_token", token);
  }

  getToken(): string | null {
    return this.token || sessionStorage.getItem("auth_token");
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    const token = this.getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  }

  async get(endpoint: string) {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: "GET",
        headers: this.getHeaders(),
      });
      return this.handleResponse(response);
    } catch (err) {
      return this.handleNetworkError(err, "GET", endpoint);
    }
  }

  async post(endpoint: string, data: unknown) {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(data),
      });
      return this.handleResponse(response);
    } catch (err) {
      return this.handleNetworkError(err, "POST", endpoint);
    }
  }

  async put(endpoint: string, data: unknown) {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: "PUT",
        headers: this.getHeaders(),
        body: JSON.stringify(data),
      });
      return this.handleResponse(response);
    } catch (err) {
      return this.handleNetworkError(err, "PUT", endpoint);
    }
  }

  async delete(endpoint: string) {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: "DELETE",
        headers: this.getHeaders(),
      });
      return this.handleResponse(response);
    } catch (err) {
      return this.handleNetworkError(err, "DELETE", endpoint);
    }
  }

  async postFormData(endpoint: string, formData: FormData) {
    try {
      const headers: Record<string, string> = {};
      const token = this.getToken();
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      // Don't set Content-Type — browser sets multipart boundary automatically
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: "POST",
        headers,
        body: formData,
      });
      return this.handleResponse(response);
    } catch (err) {
      return this.handleNetworkError(err, "POST", endpoint);
    }
  }

  private handleNetworkError(err: unknown, method: string, endpoint: string) {
    console.error(`Network error: ${method} ${this.baseUrl}${endpoint}`, err);
    const message = `Cannot reach the backend server at ${this.baseUrl}. Make sure the backend is running on the configured API port.`;
    return { data: null, error: new Error(message) };
  }

  private async handleResponse(response: Response) {
    if (response.status === 401) {
      this.clearToken();
      window.location.href = "/auth";
      throw new Error("Unauthorized - redirecting to login");
    }

    try {
      const text = await response.text();
      let data: Record<string, unknown> = {};
      
      // Try to parse JSON if response has content
      if (text) {
        try {
          data = JSON.parse(text);
        } catch (parseError) {
          console.error(`JSON parse error for ${response.url}:`, parseError);
          // If JSON parse fails but response was ok, treat as success
          if (response.ok) {
            return { data: { raw: text }, error: null };
          }
          throw new Error(`Invalid JSON response: ${text.substring(0, 100)}`);
        }
      }
      
      if (!response.ok) {
        const detail = typeof data.detail === 'string' ? data.detail : null;
        const message = typeof data.message === 'string' ? data.message : null;
        const errorMsg = detail || message || `HTTP ${response.status}`;
        throw new Error(errorMsg);
      }
      
      return { data, error: null };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Response handling error: ${errorMessage}`);
      return { data: null, error: new Error(errorMessage) };
    }
  }

  clearToken() {
    this.token = null;
    sessionStorage.removeItem("auth_token");
  }
}

export const apiClient = new APIClient();
