import { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

const variants = {
  primary:
    'bg-cyan-500 hover:bg-cyan-400 active:bg-cyan-600 text-black font-black ' +
    'shadow-[0_0_18px_rgba(0,245,255,0.35)] hover:shadow-[0_0_30px_rgba(0,245,255,0.55)] ' +
    'transition-all duration-150',
  secondary:
    'border border-cyan-500/60 text-cyan-400 hover:bg-cyan-500/12 hover:border-cyan-400 ' +
    'transition-all duration-150',
  ghost:
    'text-zinc-400 hover:text-white hover:bg-white/6 transition-all duration-150',
  danger:
    'bg-red-600 hover:bg-red-500 active:bg-red-700 text-white transition-all duration-150',
};

const sizes = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-8 py-3 text-base',
};

export function Button({ variant = 'primary', size = 'md', className = '', children, ...props }: ButtonProps) {
  return (
    <button
      className={`
        inline-flex items-center justify-center gap-2
        rounded-sm font-bold tracking-wide
        disabled:opacity-40 disabled:cursor-not-allowed
        focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-500/60
        ${variants[variant]} ${sizes[size]} ${className}
      `}
      {...props}
    >
      {children}
    </button>
  );
}
