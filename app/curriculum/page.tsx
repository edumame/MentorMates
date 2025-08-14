"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Lightbulb, 
  Pencil, 
  Figma, 
  Zap, 
  Users, 
  Trophy,
  CheckCircle,
  ArrowRight,
  BookOpen
} from "lucide-react";
import Link from "next/link";

const modules = [
  {
    id: 1,
    title: "Design Thinking Foundations",
    description: "Learn to empathize with users, define problems, and ideate creative solutions.",
    icon: Lightbulb,
    color: "bg-purple-100 text-purple-700",
    duration: "Week 1"
  },
  {
    id: 2,
    title: "Low-Fidelity Wireframing",
    description: "Capture ideas quickly through sketches and basic layout design.",
    icon: Pencil,
    color: "bg-blue-100 text-blue-700",
    duration: "Week 2"
  },
  {
    id: 3,
    title: "Prototyping with Collaborative Tools",
    description: "Build interactive prototypes using platforms like Figma to visualize and refine ideas.",
    icon: Figma,
    color: "bg-green-100 text-green-700",
    duration: "Week 3"
  },
  {
    id: 4,
    title: "Rapid Development with AI Tools",
    description: "Use AI-powered platforms such as Lovable and Cursor to accelerate building.",
    icon: Zap,
    color: "bg-yellow-100 text-yellow-700",
    duration: "Week 4"
  },
  {
    id: 5,
    title: "Hackathon Build Sprint",
    description: "Work in teams to bring your project to life under time constraints, applying both design and technical skills.",
    icon: Users,
    color: "bg-orange-100 text-orange-700",
    duration: "Week 5"
  },
  {
    id: 6,
    title: "Final Presentation & Feedback",
    description: "Pitch your completed project to judges, receive constructive feedback, and reflect on your learning journey.",
    icon: Trophy,
    color: "bg-red-100 text-red-700",
    duration: "Week 6"
  }
];

const highlights = [
  "Design thinking principles and user-centered problem-solving",
  "Hands-on experience with industry-standard tools like Figma",
  "AI-powered development with cutting-edge platforms",
  "Real-world hackathon experience with time constraints",
  "Expert mentorship and feedback throughout the program",
  "Portfolio-ready projects to showcase your skills"
];

export default function CurriculumPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-blue-50">
      {/* Header Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <div className="flex items-center justify-center mb-4">
            <BookOpen className="w-12 h-12 text-blue-900 mr-3" />
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-blue-900">
              AI Hackathon Program
            </h1>
          </div>
          <h2 className="text-2xl sm:text-3xl font-semibold text-blue-700 mb-6">
            Curriculum Overview
          </h2>
          <p className="text-lg text-gray-700 max-w-4xl mx-auto leading-relaxed">
            A hybrid learning experience that blends guided training, mentorship, and hands-on creation. 
            Students move through the complete product cycle — from idea to launch — gaining skills in 
            creative problem-solving, prototyping, and collaboration.
          </p>
        </motion.div>

        {/* Program Overview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-16"
        >
          <Card className="bg-white shadow-lg border-0">
            <CardHeader className="bg-blue-900 text-white rounded-t-lg">
              <CardTitle className="text-2xl font-bold text-center">
                Program Journey
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8">
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-xl font-semibold text-blue-900 mb-4">
                    Foundation Phase
                  </h3>
                  <p className="text-gray-700 mb-4">
                    The program begins with design thinking principles to ground participants in 
                    user-centered problem-solving. They learn how to transform ideas into wireframes, 
                    starting with low-fidelity sketches and evolving into refined, interactive prototypes.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">Design Thinking</Badge>
                    <Badge variant="secondary">Wireframing</Badge>
                    <Badge variant="secondary">User Research</Badge>
                  </div>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-blue-900 mb-4">
                    Build Phase
                  </h3>
                  <p className="text-gray-700 mb-4">
                    Tools such as Figma are introduced as collaborative design platforms, alongside 
                    rapid prototyping environments like Lovable and Cursor. The journey culminates in 
                    a high-energy hackathon where students turn their concepts into functioning projects.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">Figma</Badge>
                    <Badge variant="secondary">Lovable</Badge>
                    <Badge variant="secondary">Cursor</Badge>
                    <Badge variant="secondary">AI Tools</Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Modules Section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mb-16"
        >
          <h2 className="text-3xl font-bold text-blue-900 text-center mb-12">
            Modules Breakdown
          </h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {modules.map((module, index) => (
              <motion.div
                key={module.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 * index }}
              >
                <Card className="h-full hover:shadow-lg transition-shadow duration-300 border-0 shadow-md">
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className={`p-3 rounded-full ${module.color}`}>
                        <module.icon className="w-6 h-6" />
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {module.duration}
                      </Badge>
                    </div>
                    <CardTitle className="text-lg font-semibold text-blue-900 leading-tight">
                      Module {module.id} – {module.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600 text-sm leading-relaxed">
                      {module.description}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Program Highlights */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mb-16"
        >
          <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-blue-900 text-center">
                What You'll Gain
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                {highlights.map((highlight, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: 0.1 * index }}
                    className="flex items-start space-x-3"
                  >
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700 text-sm">{highlight}</span>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Call to Action */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="text-center"
        >
          <Card className="bg-blue-900 text-white border-0 shadow-xl">
            <CardContent className="p-12">
              <h2 className="text-3xl font-bold mb-6">
                Ready to Transform Ideas into Reality?
              </h2>
              <p className="text-xl text-blue-100 mb-8 max-w-3xl mx-auto leading-relaxed">
                Join the AI Hackathon Program to challenge yourself, collaborate with peers, and learn 
                to design, build, and launch projects that make an impact. Whether you're exploring new 
                tools or refining your skills, this experience will equip you with the confidence and 
                knowledge to turn ideas into reality.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <Button 
                  size="lg" 
                  className="bg-white text-blue-900 hover:bg-gray-100 px-8 py-3 text-lg font-semibold rounded-full shadow-lg transition-all duration-300 hover:shadow-xl"
                >
                  Enroll Now
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
                <Link href="/events">
                  <Button 
                    variant="outline" 
                    size="lg"
                    className="border-white text-white hover:bg-white hover:text-blue-900 px-8 py-3 text-lg font-semibold rounded-full transition-all duration-300"
                  >
                    View Events
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}