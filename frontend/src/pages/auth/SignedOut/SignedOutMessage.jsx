import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { googleLoginUrl } from "@/api/client";

export default function SignedOutMessage() {
  return <section className="relative -mt-10 flex min-h-[calc(40svh+2.5rem)] flex-1 flex-col items-center rounded-t-[40px] bg-white px-[clamp(1.25rem,7vw,2rem)] pb-10 pt-[clamp(2rem,5.7svh,3rem)] sm:m-0 sm:grid sm:min-h-screen sm:place-items-center sm:rounded-none sm:px-[clamp(1rem,3vw,2rem)] sm:py-12">
    <div className="grid w-full max-w-[420px] justify-items-center text-center">
      <h1 className="text-[clamp(1.25rem,calc(1rem+1.4vw),2rem)] font-bold leading-tight text-black sm:font-extrabold sm:text-[#253044]">You've been signed out</h1>
      <p className="mt-2 text-[clamp(0.6875rem,calc(0.5rem+0.9vw),1.125rem)] font-normal text-[#737373] sm:text-slate-600">Thanks for using the system</p>
      <button type="button" onClick={() => { window.location.href = googleLoginUrl(); }} className="mt-[clamp(1.25rem,2.5vw,2rem)] inline-flex h-[clamp(2.75rem,calc(2.25rem+1.25vw),3.25rem)] w-[min(100%,clamp(13rem,72vw,22rem))] items-center justify-center gap-[clamp(0.5rem,1vw,0.75rem)] rounded-[5px] bg-[#172f6b] px-5 text-[clamp(0.75rem,calc(0.65rem+0.55vw),1rem)] font-semibold text-white transition-colors hover:bg-[#132859] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#172f6b] sm:hidden">
        <ArrowRight aria-hidden="true" className="size-[clamp(1rem,1.6vw,1.25rem)]" />Sign in with Google
      </button>
      <Link to="/login" replace className="mt-[clamp(1.25rem,2.5vw,2rem)] hidden h-[clamp(2.75rem,calc(2.25rem+1.25vw),3.25rem)] w-[min(100%,clamp(13rem,72vw,22rem))] items-center justify-center gap-[clamp(0.5rem,1vw,0.75rem)] rounded-[5px] bg-[#203b82] px-5 text-[clamp(0.75rem,calc(0.65rem+0.55vw),1rem)] font-semibold text-white transition-colors hover:bg-[#182e67] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#203b82] sm:inline-flex">
        <ArrowRight aria-hidden="true" className="size-[clamp(1rem,1.6vw,1.25rem)]" />Sign in again
      </Link>
      <p className="mt-[clamp(1.25rem,2.5vw,2rem)] text-[clamp(0.6875rem,calc(0.6rem+0.3vw),0.8125rem)] font-normal italic text-[#737373] sm:not-italic sm:text-slate-500">Use your official LV email account to login.</p>
    </div>
  </section>;
}
