import { Link } from "react-router-dom";
import { SignIn, SignUp } from "@clerk/react";
import { PawPrint } from "lucide-react";
import { CATEGORY_META } from "@/lib/shop";

const Shell = ({ children }) => (
  <div className="grid min-h-[calc(100vh-140px)] lg:grid-cols-2">
    <div className="grain relative hidden flex-col justify-end overflow-hidden bg-orange-600 p-12 text-white lg:flex">
      <img src={CATEGORY_META.kedi.img} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40 mix-blend-multiply" />
      <div className="relative">
        <PawPrint className="h-10 w-10" />
        <h2 className="mt-4 text-5xl font-extrabold leading-tight">Dostun için<br />en iyisi, kapında.</h2>
      </div>
    </div>
    <div className="flex items-center justify-center px-4 pb-10 pt-8 sm:pt-12">{children}</div>
  </div>
);

export const SignInPage = () => (
  <Shell>
    <div className="flex flex-col items-center gap-4">
      <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" withSignUp />
      <p className="text-sm text-zinc-600">Hesabın yok mu? <Link to="/sign-up" data-testid="sign-in-to-sign-up-link" className="font-bold text-orange-700 hover:underline">Üye Ol</Link></p>
    </div>
  </Shell>
);

export const SignUpPage = () => (
  <Shell>
    <div className="flex flex-col items-center gap-4">
      <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" />
      <p className="text-sm text-zinc-600">Zaten üye misin? <Link to="/sign-in" data-testid="sign-up-to-sign-in-link" className="font-bold text-orange-700 hover:underline">Giriş Yap</Link></p>
    </div>
  </Shell>
);
