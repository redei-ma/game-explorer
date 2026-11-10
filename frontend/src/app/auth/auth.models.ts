export interface User {
  id: string;
  email: string;
  username: string;
}

export interface AuthResponse {
  expiresAt: string;
  user: User;
}

export interface RegisterResponse extends AuthResponse {
  recoveryCode: string;
}
