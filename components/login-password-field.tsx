"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";

export function LoginPasswordField() {
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;
  return <div>
    <label className="block text-sm font-medium" htmlFor="negosu-login-password-input">Password</label>
    <div className="relative mt-2">
      <Input id="negosu-login-password-input" required autoComplete="current-password" name="password" type={visible ? "text" : "password"} className="pr-12"/>
      <button id="negosu-login-password-toggle" type="button" aria-label={visible ? "Hide password" : "Show password"} aria-controls="negosu-login-password-input" aria-pressed={visible} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-ui-md text-admin-text-secondary hover:text-admin-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary" onClick={() => setVisible(value => !value)}>
        <Icon size={18} aria-hidden="true"/>
      </button>
    </div>
  </div>;
}
