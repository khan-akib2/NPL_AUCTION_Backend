export default function Logo({ size = 'md', className = '' }) {
  const sizes = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24',
    '2xl': 'w-36 h-36',
  };
  return (
    <img
      src="/NPL.png"
      alt="NPL Logo"
      className={`${sizes[size]} object-contain ${className}`}
    />
  );
}
