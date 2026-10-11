import type { ButtonHTMLAttributes } from 'react';

export default function GelButton({
  green,
  mini,
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { green?: boolean; mini?: boolean }) {
  return <button type="button" {...rest} className={`gel ${green ? 'green' : ''} ${mini ? 'mini' : ''} ${className}`} />;
}
