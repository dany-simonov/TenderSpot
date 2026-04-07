interface BlueRhombusLogoProps {
  size?: number;
  withWordmark?: boolean;
  textClassName?: string;
}

const BlueRhombusLogo = ({
  size = 20,
  withWordmark = true,
  textClassName = 'mono font-bold text-base tracking-tight',
}: BlueRhombusLogoProps) => {
  return (
    <div className="flex items-center gap-2">
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="#2563EB"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path d="M12 2L22 12L12 22L2 12L12 2Z" />
      </svg>

      {withWordmark && (
        <span className={textClassName} style={{ color: 'var(--ts-text-primary)' }}>
          TenderSpot
        </span>
      )}
    </div>
  );
};

export default BlueRhombusLogo;
