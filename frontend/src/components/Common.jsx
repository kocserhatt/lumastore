import { Link } from "react-router-dom";
import { Show } from "@clerk/react";
import { Navigate } from "react-router-dom";

export const RequireAuth = ({ children }) => (
  <>
    <Show when="signed-in">{children}</Show>
    <Show when="signed-out"><Navigate to="/sign-in" replace /></Show>
  </>
);

export const EmptyState = ({ icon: Icon, title, text, cta, to, testId }) => (
  <div data-testid={testId} className="flex flex-col items-center rounded-3xl border border-dashed border-orange-200 bg-white px-6 py-14 text-center">
    <span className="grid h-16 w-16 place-items-center rounded-full bg-orange-100 text-orange-700"><Icon className="h-7 w-7" /></span>
    <h2 className="mt-4 text-xl font-bold">{title}</h2>
    <p className="mt-1 max-w-sm text-sm text-zinc-500">{text}</p>
    {cta && <Link to={to} className="mt-6 rounded-full bg-orange-600 px-6 py-3 text-sm font-semibold text-white hover:bg-orange-700">{cta}</Link>}
  </div>
);

export const PageTitle = ({ kicker, title, children }) => (
  <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
    <div>
      {kicker && <div className="text-xs font-bold uppercase tracking-[0.2em] text-orange-600">{kicker}</div>}
      <h1 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h1>
    </div>
    {children}
  </div>
);
