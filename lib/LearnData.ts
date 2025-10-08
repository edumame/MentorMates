interface LearnItem {
    id: number;
    title: string;
    description: string;
    source: string;
    readingTime: number;
    thumbnail: string;
}
export const data: LearnItem[] = [
    {
        id: 1,
        title: "What is a Hackathon?",
        description: "Get a good grasp of what a hackathon is and how to prepare for one.",
        source: "https://www.canva.com/design/DAGiIjTZwwU/qZ9YyzVj0Qw_mPg10wFePQ/view?utm_content=DAGiIjTZwwU&utm_campaign=designshare&utm_medium=link2&utm_source=uniquelinks&utlId=h02954ba739",
        readingTime: 20,
        thumbnail: "/img/resource01.png",
    },
    {
        id: 2,
        title: "Stages of a Hackathon",
        description: "Learn about the different stages of a hackathon and how to navigate them.",
        source: "https://www.canva.com/design/DAGjnPa_Ko8/CLjZvYNfP1l3s4VZgN9Mjg/view?utm_content=DAGjnPa_Ko8&utm_campaign=designshare&utm_medium=link2&utm_source=uniquelinks&utlId=hf6cbf39f60",
        readingTime: 20,
        thumbnail: "/img/resource02.png",
    },
    {
        id: 3,
        title: "How to Mentor in a Hackathon",
        description: "Learn how to mentor in a hackathon and how to evaluate projects.",
        source: "https://www.canva.com/design/DAGjZKp9f58/JdJFk47M4tC9sQqHw8uUQQ/view?utm_content=DAGjZKp9f58&utm_campaign=designshare&utm_medium=link2&utm_source=uniquelinks&utlId=h9852926523",
        readingTime: 20,
        thumbnail: "/img/placeholder.png",
    },
    {
        id: 4,
        title: "How to Organize a Hackathon",
        description: "Learn how to organize a hackathon and how to evaluate projects.",
        source: "https://www.canva.com/design/DAGjZKp9f58/JdJFk47M4tC9sQqHw8uUQQ/view?utm_content=DAGjZKp9f58&utm_campaign=designshare&utm_medium=link2&utm_source=uniquelinks&utlId=h9852926523",
        readingTime: 20,
        thumbnail: "/img/placeholder.png",
    },
    {
        id: 5,
        title: "How to Evaluate a Hackathon",
        description: "Learn how to evaluate a hackathon and how to evaluate projects.",
        source: "https://www.canva.com/design/DAGjZKp9f58/JdJFk47M4tC9sQqHw8uUQQ/view?utm_content=DAGjZKp9f58&utm_campaign=designshare&utm_medium=link2&utm_source=uniquelinks&utlId=h9852926523",
        readingTime: 20,
        thumbnail: "/img/placeholder.png",
    },
    {
        id: 6,
        title: "Lovable.dev Setup for Hackathon",
        description: "Step-by-step to set up your Lovable.dev workspace and Pro Plan.",
        source: "https://docs.google.com/document/d/1237DrCLjCJKUY65Sh2gfHhWYe8Ids6e7AK9yn-ZkHs8/edit?usp=drivesdk",
        readingTime: 5,
        thumbnail: "/img/placeholder.png",
    },
];