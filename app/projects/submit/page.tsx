"use client";

import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { NewProjectSubmissionFormSinglePage } from "@/features/projects/components/forms/NewProjectSubmissionFormSinglePage";

export default function SubmitProjectPage() {
	const router = useRouter();
	return (
		<div className="w-full max-w-4xl mx-auto px-6 py-8 bg-white rounded-xl shadow-xl">
			<div className="flex justify-start items-center mb-6">
				<Button variant="ghost" onClick={() => router.push("/projects")} className="flex items-center gap-2">
					<ArrowLeft className="h-4 w-4" />
					Back to Projects
				</Button>
			</div>
			<NewProjectSubmissionFormSinglePage />
		</div>
	);
}