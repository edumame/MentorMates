import Image from "next/image";

type HostIconProps = {
  className?: string;
};

export function RobotIcon({ className }: HostIconProps) {
  return (
    <Image
      src="/img/robot_2.svg"
      alt=""
      width={48}
      height={48}
      className={className}
    />
  );
}

export function InboxCustomizeIcon({ className }: HostIconProps) {
  return (
    <Image
      src="/img/inbox_customize.svg"
      alt=""
      width={48}
      height={48}
      className={className}
    />
  );
}

export function CheckCircleIcon({ className }: HostIconProps) {
  return (
    <Image
      src="/img/check-circle.svg"
      alt=""
      width={28}
      height={28}
      className={className}
    />
  );
}
