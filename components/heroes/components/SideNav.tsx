import Link from "next/link";

const data = [
    {
        name: "Home",
        href: "/",
    },
    {
        name: "Event",
        href: "/events",
    },
    {
        name: "Learn",
        href: "/learn",
    },
    {
        name: "Project",
        href: "/project",
    },
    {
        name: "Feedback",
        href: "/feedback",
    },
]


export function SideNav() {
    return (
        <div>
            <h1>SideNav</h1>
            <div className="flex flex-col gap-4">
                {data.map((item) => (
                    <Link href={item.href} key={item.name}>
                        {item.name}
                    </Link>
                ))}
            </div>
        </div>
    );
}