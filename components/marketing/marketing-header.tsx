"use client";

import { useEffect, useRef, useState } from "react";
import { Menu, X, UserRound, Play as PlayIcon } from "lucide-react";
import Link from "next/link";
import { BrandWordmark } from "@/components/brand-wordmark";
import { productBrand, petCareBrand, marketingBrands, hospitalityBrand, type MarketingVerticalKey } from "@/modules/platform/brand";

export function MarketingHeader({ vertical }: { vertical?: MarketingVerticalKey }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 0);
    const desktop = window.matchMedia("(min-width: 1280px)");
    const onResize = () => { if (desktop.matches) setOpen(false); };
    const root = document.documentElement;
    const previousPadding = root.style.scrollPaddingTop;
    root.style.scrollPaddingTop = "5rem";
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    desktop.addEventListener("change", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll);
      desktop.removeEventListener("change", onResize);
      root.style.scrollPaddingTop = previousPadding;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !menu.current?.contains(event.target)) setOpen(false);
    };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); toggle.current?.focus(); }
    };
    const focusOutside = (event: FocusEvent) => {
      if (event.target instanceof Node && !menu.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", keyboard);
    document.addEventListener("focusin", focusOutside);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", keyboard);
      document.removeEventListener("focusin", focusOutside);
    };
  }, [open]);

  const signupPath = vertical ? marketingBrands[vertical].signupPath : "/signup";
  const loginPath = vertical ? marketingBrands[vertical].loginPath : "/login";

  return (
    <>
    <div aria-hidden="true" className="h-16"/>
    <header id="negosu-main-header" data-scrolled={scrolled} className={`fixed inset-x-0 top-0 z-50 border-b border-brand-border/70 bg-white/95 transition-shadow ${scrolled ? "shadow-md" : "shadow-none"}`}>
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link id="negosu-header-home-link" href="/" className="inline-flex min-h-11 items-center" aria-label={`${productBrand.name} home`}>
          <BrandWordmark className="w-32" />
        </Link>

        <nav id="negosu-desktop-navigation" className="hidden items-center gap-1 xl:flex" aria-label="Main navigation">
          <Link id="negosu-desktop-solutions-link" href="/#solutions" className="rounded-xl px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-brand-tint hover:text-brand-ink">Solutions</Link>
          <Link id="negosu-desktop-automotive-link" href={marketingBrands.automotive.path} className="rounded-xl px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-brand-tint hover:text-brand-ink">Automotive</Link>
          <Link id="negosu-desktop-salon-link" href={marketingBrands.salon.path} className="rounded-xl px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-brand-tint hover:text-brand-ink">Salon &amp; Beauty</Link>
          <Link id="negosu-desktop-pet-care-link" href={petCareBrand.path} className="rounded-xl px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-brand-tint hover:text-brand-ink">Pet Care</Link>
          <Link id="negosu-desktop-hospitality-link" href={hospitalityBrand.path} className="rounded-xl px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-brand-tint hover:text-brand-ink">Apartelle &amp; Inn</Link>
          <Link id="negosu-desktop-features-link" href="/#features" className="rounded-xl px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-brand-tint hover:text-brand-ink">Features</Link>
          <Link id="negosu-desktop-contact-link" href="/contact" className="rounded-xl px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-brand-tint">Contact</Link>
          <Link id="negosu-desktop-plans-link" href="/plans" className="rounded-xl px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-brand-tint hover:text-brand-ink">Plans</Link>
        </nav>

        <div className="hidden items-center gap-2 xl:flex">
          <Link id="negosu-header-sign-in-link" href={loginPath} className="inline-flex min-h-11 items-center rounded-xl px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100">Sign In</Link>
          <Link id="negosu-header-start-free-button" href={signupPath} className="inline-flex min-h-11 items-center rounded-xl bg-brand-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-primary-strong"><PlayIcon aria-hidden="true" size={16} className="shrink-0"/>Start Free</Link>
        </div>

        <div className="flex items-center gap-2 xl:hidden">
        <Link id="negosu-mobile-account-link" href={loginPath} aria-label="Sign in to your account" className="grid size-11 place-items-center rounded-xl border border-brand-border text-brand-ink hover:bg-brand-tint"><UserRound aria-hidden="true" size={20}/></Link>
        <div ref={menu} id="negosu-mobile-menu" className="relative">
          <button ref={toggle} type="button" id="negosu-mobile-menu-button" onClick={() => setOpen(value => !value)} className="flex size-11 items-center justify-center rounded-xl border border-brand-border text-brand-ink hover:bg-brand-tint" aria-label={open ? "Close navigation menu" : "Open navigation menu"} aria-expanded={open} aria-controls="negosu-mobile-navigation">
            {open ? <X aria-hidden="true" size={20}/> : <Menu aria-hidden="true" size={20}/>}
          </button>
          <nav hidden={!open} onClick={event => { if (event.target instanceof Element && event.target.closest("a")) setOpen(false); }} id="negosu-mobile-navigation" className="absolute right-0 z-30 mt-2 max-h-[calc(100dvh-5rem)] overflow-y-auto overscroll-contain w-[min(18rem,calc(100vw-2rem))] rounded-2xl border border-zinc-200 bg-white p-2 shadow-lg" aria-label="Mobile navigation">
            <Link id="negosu-mobile-solutions-link" href="/#solutions" className="block min-h-11 rounded-xl px-3 py-3 text-sm font-medium hover:bg-zinc-50">Solutions</Link>
            <Link id="negosu-mobile-automotive-link" href={marketingBrands.automotive.path} className="block min-h-11 rounded-xl px-3 py-3 text-sm font-medium text-zinc-600 hover:bg-zinc-50">Automotive</Link>
            <Link id="negosu-mobile-salon-link" href={marketingBrands.salon.path} className="block min-h-11 rounded-xl px-3 py-3 text-sm font-medium text-zinc-600 hover:bg-zinc-50">Salon &amp; Beauty</Link>
            <Link id="negosu-mobile-pet-care-link" href={petCareBrand.path} className="block min-h-11 rounded-xl px-3 py-3 text-sm font-medium text-zinc-600 hover:bg-zinc-50">Pet Care</Link>
            <Link id="negosu-mobile-hospitality-link" href={hospitalityBrand.path} className="block min-h-11 rounded-xl px-3 py-3 text-sm font-medium text-zinc-600 hover:bg-zinc-50">Apartelle &amp; Inn</Link>
          <Link id="negosu-mobile-features-link" href="/#features" className="block min-h-11 rounded-xl px-3 py-3 text-sm font-medium text-zinc-600 hover:bg-zinc-50">Features</Link>
            <Link id="negosu-mobile-contact-link" href="/contact" className="block min-h-11 rounded-xl px-3 py-3 text-sm font-medium text-zinc-600 hover:bg-zinc-50">Contact us</Link>
            <Link id="negosu-mobile-plans-link" href="/plans" className="block min-h-11 rounded-xl px-3 py-3 text-sm font-medium text-zinc-600 hover:bg-zinc-50">Plans</Link>
            <div className="mt-2 grid gap-2 border-t border-zinc-100 pt-2">
              <Link id="negosu-mobile-sign-in-link" href={loginPath} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-zinc-200 px-4 text-sm font-medium">Sign In</Link>
              <Link id="negosu-mobile-start-free-button" href={signupPath} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand-primary px-4 text-sm font-medium text-white"><PlayIcon aria-hidden="true" size={16} className="shrink-0"/>Start Free</Link>
            </div>
          </nav>
        </div>
        </div>
      </div>
    </header>
    </>
  );
}
