"use client";

import { Footer } from "@/components/layout/footer";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function JoinPage() {
	return (
		<div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-2">
			<div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10 pt-16">
				{/* Hero */}
				<div className="text-center space-y-3">
					<h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-gray-900 tracking-tight">
						Join <span className="bg-clip-text text-blue-900 bg-gradient-to-r from-blue-900 to-blue-300">MentorMates</span>
					</h1>
					<p className="max-w-prose mx-auto text-lg text-gray-700">
						How would you like to join?
					</p>
				</div>

				{/* Mission (condensed) */}
				<section className="bg-white/70 shadow-lg p-6 rounded-xl transition-shadow hover:shadow-2xl">
					<h2 className="text-2xl font-bold text-gray-900 mb-3">Our Mission</h2>
					<div className="text-gray-800 text-md space-y-4 text-justify">
						<p>
							We are living in the age of AI, where people feel both excitement and fear. Many want to explore, but also worry about being left behind. Hackathons are one of the best ways to expose people to new technologies, but they often feel intimidating. In just 48 hours, participants are told to “build something,” yet most receive little guidance or scaffolding. This creates a huge barrier to entry—especially for beginners, students from underrepresented backgrounds, and those without prior coding or entrepreneurial experience.
						</p>
						<p>
							The result is that hackathons, which should be gateways to curiosity and innovation, can instead feel exclusive and overwhelming. I've seen this first-hand both as a participant and as an organizer. At{' '}
							<a
								href="https://ed.stanford.edu/giving/story/ready-set-solve"
								target="_blank"
								rel="noopener noreferrer"
								className="text-blue-900 underline hover:text-blue-700"
							>
								Stanford’s AI + Learning Differences hackathon
							</a>
							, I focused on showing that hackathons can be about social impact and inclusivity—not just building tech for tech’s sake. What participants valued most was the sense of support, mentorship, and community.
						</p>
						<p>
							MentorMates addresses this gap by making sure every participant gets structured feedback, encouragement, and scaffolding. Our goal is to democratize entrepreneurial education through hackathons, making them more inclusive and accessible. We want hackathons to be spaces where anyone, regardless of background or skill level, can feel confident exploring technology and creating impact.
						</p>
					</div>
				</section>

				{/* Role-based tabs */}
				<section className="bg-white/70 shadow-lg p-4 sm:p-6 rounded-xl transition-shadow hover:shadow-2xl">
					<Tabs defaultValue="mentor" className="w-full">
						<TabsList className="grid grid-cols-3 w-full">
							<TabsTrigger value="mentor">Mentor / Judge</TabsTrigger>
							<TabsTrigger value="organizer">Organizer</TabsTrigger>
							<TabsTrigger value="hiring">Hiring</TabsTrigger>
						</TabsList>

						{/* Mentors & Judges */}
						<TabsContent value="mentor" className="mt-6">
							<div className="space-y-6">
								<div className="bg-white rounded-lg border p-5">
									<h3 className="text-xl font-semibold text-gray-900 mb-2">Why join as a Mentor or Judge?</h3>
									<ul className="list-disc pl-5 text-gray-800 space-y-2">
										<li>Direct impact on builders, with structured feedback loops and visibility</li>
										<li>Grow your professional network with founders, students, and organizers</li>
										<li>We provide documentation and recognition of your contributions, helpful for O-1 / EB-1A evidence</li>
									</ul>
									<p className="text-sm text-gray-600 mt-2">Note: We do not provide legal advice. We can offer letters describing your contributions and impact.</p>
								</div>

								<div>
									<iframe
										src="https://forms.gle/uUwgspDN8fQmHjiB6"
										className="w-full h-[900px] md:h-[1100px] rounded-md border"
										loading="lazy"
										title="Mentor & Judge Interest Form"
									/>
									<p className="mt-4 text-sm text-gray-600">
										Having trouble viewing the embedded form?{' '}
										<a
											href="https://forms.gle/uUwgspDN8fQmHjiB6"
											target="_blank"
											rel="noopener noreferrer"
											className="text-blue-900 underline hover:text-blue-700"
										>
											Open it in a new tab
										</a>
										.
									</p>
								</div>
							</div>
						</TabsContent>

						{/* Organizers */}
						<TabsContent value="organizer" className="mt-6">
							<div className="space-y-6">
								<div className="bg-white rounded-lg border p-5">
									<h3 className="text-xl font-semibold text-gray-900 mb-2">Why partner as an Organizer?</h3>
									<ul className="list-disc pl-5 text-gray-800 space-y-2">
										<li>Structured mentorship and feedback to help participants go further post-event</li>
										<li>Engagement analytics and DevPost-friendly workflows</li>
										<li>
											We recently received support from Stanford to back hackathons. Learn more:{' '}
											<Link
												href="https://acceleratelearning.stanford.edu/funding/people-who-help-other-people-learn-pwhopl/"
												target="_blank"
												rel="noopener noreferrer"
												className="text-blue-900 underline hover:text-blue-700"
											>
												Supported by Stanford Accelerator for Learning
											</Link>
										</li>
									</ul>
									<p className="text-sm text-gray-600 mt-2">We have limited budget to support select hackathons and can involve your event in ongoing Stanford research.</p>
								</div>

								{/* DevPost Integration CTA */}
								<div className="bg-white rounded-lg border p-5">
									<h4 className="text-lg font-semibold text-gray-900 mb-2">Already using DevPost?</h4>
									<p className="text-gray-700 text-sm mb-4">
										MentorMates integrates with DevPost to add structured feedback, mentorship connections, and engagement analytics.
									</p>
									<div className="flex flex-col sm:flex-row gap-3">
										<a
											href="/devpost-integration"
											className="inline-flex items-center px-4 py-2 bg-blue-900 text-white rounded-md hover:bg-blue-800 transition-colors duration-200 text-center justify-center"
										>
											Learn About DevPost Integration
											<ArrowRight className="ml-2 h-4 w-4" />
										</a>
										<a
											href="mailto:admin@mentormates.ai?subject=DevPost%20Integration%20Inquiry"
											className="inline-flex items-center px-4 py-2 border border-blue-900 text-blue-900 rounded-md hover:bg-blue-50 transition-colors duration-200 text-center justify-center"
										>
											Contact Us About Integration
										</a>
									</div>
								</div>

								<div>
									<iframe
										src="https://forms.gle/R8r3u1uosEswUFE79"
										className="w-full h-[900px] md:h-[1100px] rounded-md border"
										loading="lazy"
										title="Organizer Interest Form"
									/>
									<p className="mt-4 text-sm text-gray-600">
										Having trouble viewing the embedded form?{' '}
										<a
											href="https://forms.gle/R8r3u1uosEswUFE79"
											target="_blank"
											rel="noopener noreferrer"
											className="text-blue-900 underline hover:text-blue-700"
										>
											Open it in a new tab
										</a>
										.
									</p>
								</div>
							</div>
						</TabsContent>

						{/* Hiring */}
						<TabsContent value="hiring" className="mt-6">
							<div className="space-y-6">
								<div className="bg-white rounded-lg border p-5">
									<h3 className="text-xl font-semibold text-gray-900 mb-2">Work with MentorMates</h3>
									<ul className="list-disc pl-5 text-gray-800 space-y-2">
										<li>Build community and empower the next generation of innovators</li>
										<li>Collaborate with mentors and organizers from leading institutions</li>
										<li>Flexible, impact-driven roles across mentorship, ops, and partnerships</li>
									</ul>
									<div className="mt-4">
										<Link
											href="/join/hiring"
											className="inline-flex items-center px-4 py-2 bg-blue-900 text-white rounded-md hover:bg-blue-800 transition-colors duration-200"
										>
											We&apos;re Hiring
										</Link>
									</div>
								</div>
							</div>
						</TabsContent>
					</Tabs>
				</section>

				{/* Contact */}
				<section className="bg-white/70 shadow-lg p-6 rounded-xl transition-shadow hover:shadow-2xl">
					<h2 className="text-2xl font-bold text-gray-900 mb-3">Get in touch</h2>
					<p className="text-gray-800 text-md">
						Prefer email? Reach us at{' '}
						<a href="mailto:admin@mentormates.ai" className="text-blue-900 underline hover:text-blue-700">
							admin@mentormates.ai
						</a>
						.
					</p>
				</section>
			</div>

			<div className="pt-10">
				<Footer />
			</div>
		</div>
	);
}

