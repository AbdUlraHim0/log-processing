"use client";

import Link from "next/link";

export default function Confirmation() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-lg shadow-md">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Check Your Email</h1>
          <p className="mt-4 text-gray-600">
            We've sent you a confirmation email. Please check your inbox and
            click the link to verify your account.
          </p>
          <div className="mt-6">
            <Link href="/" className="text-blue-500 hover:text-blue-600">
              Return to home page
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
