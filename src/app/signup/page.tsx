import { getEnabledOAuthProviders } from "@/lib/auth-providers";
import { SignupClient } from "./signup-client";

export default async function SignupPage() {
  return <SignupClient providers={await getEnabledOAuthProviders()} />;
}
