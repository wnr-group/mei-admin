"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "@/services/auth";

const Login = () => {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await signIn(email, password);
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred during sign in';
      setError(message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-off-white px-4 font-inter">
      <div className="w-full max-w-[420px] bg-white border border-border px-12 pt-16 pb-14 text-center">
        {/* Logo Section */}
        <div className="flex flex-col items-center select-none">
          <span className="font-cormorant text-[42px] font-normal leading-none text-gold tracking-wide">
            MEI
          </span>
          <span className="font-inter text-[9px] font-medium tracking-[0.28em] text-gold mt-2">
            BRIDAL COUTURE
          </span>
        </div>

        {/* Title */}
        <h2 className="font-inter text-[15px] font-semibold text-text-primary mt-12 mb-8 tracking-wide">
          Admin Sign In
        </h2>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col text-left">
          {/* Email Input */}
          <div className="mb-6">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="w-full border-b border-border py-2.5 text-[14px] text-text-primary placeholder:text-text-muted focus:outline-hidden focus:border-gold bg-transparent transition-colors font-inter"
              required
            />
          </div>

          {/* Password Input */}
          <div className="mb-6">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full border-b border-border py-2.5 text-[14px] text-text-primary placeholder:text-text-muted focus:outline-hidden focus:border-gold bg-transparent transition-colors font-inter"
              required
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="text-[#d32f2f] text-[11px] font-bold text-center mt-2 mb-6 tracking-wide font-inter">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gold hover:bg-gold-hover text-white text-[12px] font-bold py-3.5 tracking-[0.18em] transition-colors duration-200 uppercase cursor-pointer border-0 rounded-none disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Signing in…" : "SIGN IN"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;