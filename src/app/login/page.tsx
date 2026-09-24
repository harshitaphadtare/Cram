import { getEnabledOAuthProviders } from "@/lib/auth-providers";
import { LoginClient } from "./login-client";

export default async function LoginPage() {
  return <LoginClient providers={await getEnabledOAuthProviders()} />;
}
