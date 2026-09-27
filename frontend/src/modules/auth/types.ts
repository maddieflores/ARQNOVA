export interface AuthUser {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  role: { id: string; name: string };
}
export interface LoginResponse { accessToken: string; user: AuthUser; }
export interface LoginInput { email: string; password: string; }
export interface RegisterInput { name: string; email: string; password: string; passwordConfirmation: string; }
export interface RegisterResponse { message: string; user: AuthUser; }
