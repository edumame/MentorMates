"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/layout/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { 
  ArrowRight, 
  Calendar, 
  Users, 
  Zap, 
  Code, 
  Rocket, 
  Brain,
  CheckCircle,
  Star,
  Clock,
  Award
} from "lucide-react";

export default function AIVibeMasterclassPage() {
  const [hoveredWeek, setHoveredWeek] = useState<number | null>(null);

  const fadeInUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5 }
  };

  const staggerChildren = {
    animate: {
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-white via-blue-50/20 to-white">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-grid-pattern opacity-[0.02]" />
      <div className="absolute top-0 right-0 w-96 h-96 bg-blue-400/10 rounded-full filter blur-3xl" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-400/10 rounded-full filter blur-3xl" />
      
      <div className="relative z-10 px-5 py-8 md:py-16">
        {/* Hero Section with Enhanced Design */}
        <motion.div 
          className="max-w-6xl mx-auto text-center"
          initial="initial"
          animate="animate"
          variants={staggerChildren}
        >
          {/* Badge */}
          <motion.div variants={fadeInUp} className="mb-6">
            <span className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-100 to-purple-100 border border-blue-200 rounded-full text-sm font-medium text-blue-900">
              <Zap className="w-4 h-4" />
              Limited to 12 Seats • Starting Soon
            </span>
          </motion.div>

          {/* Main Title with Gradient */}
          <motion.h1 
            variants={fadeInUp}
            className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 bg-gradient-to-r from-blue-900 via-blue-700 to-purple-700 bg-clip-text text-transparent"
          >
            Unlock Your AI Vibe
          </motion.h1>
          
          <motion.p 
            variants={fadeInUp}
            className="text-2xl md:text-3xl font-semibold text-gray-800 mb-4"
          >
            Master Coding, Agents, and Entrepreneurship
          </motion.p>
          
          <motion.p 
            variants={fadeInUp}
            className="text-gray-600 text-lg md:text-xl max-w-3xl mx-auto mb-8"
          >
            A 5-week, high-impact masterclass blending AI, code, and entrepreneurial energy. 
            Transform from builder to entrepreneur with personalized mentorship.
          </motion.p>

          {/* Key Stats */}
          <motion.div 
            variants={fadeInUp}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto mb-8"
          >
            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="text-3xl font-bold text-blue-900">5</div>
              <div className="text-sm text-gray-600">Weeks</div>
            </div>
            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="text-3xl font-bold text-blue-900">12</div>
              <div className="text-sm text-gray-600">Seats Only</div>
            </div>
            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="text-3xl font-bold text-blue-900">15+</div>
              <div className="text-sm text-gray-600">Hours Live</div>
            </div>
            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="text-3xl font-bold text-blue-900">1:1</div>
              <div className="text-sm text-gray-600">Mentorship</div>
            </div>
          </motion.div>

          {/* Video Section with Better Styling */}
          <motion.div 
            variants={fadeInUp}
            className="relative mx-auto w-full max-w-4xl mb-10"
          >
            <div className="relative overflow-hidden rounded-2xl shadow-2xl bg-gradient-to-r from-blue-600 to-purple-600 p-1">
              <div className="relative pt-[56.25%] bg-black rounded-xl overflow-hidden">
                <iframe
                  className="absolute inset-0 h-full w-full"
                  src="https://www.youtube.com/embed/qYBzs7-GTx8?rel=0"
                  title="AI Vibe Coding Masterclass Intro"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              </div>
            </div>
          </motion.div>

          {/* CTAs with better design */}
          <motion.div 
            variants={fadeInUp}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link href="/ai-vibe-masterclass/checkout">
              <Button 
                variant="default" 
                className="group px-8 py-6 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
              >
                Reserve Your Seat Now
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link href="#curriculum">
              <Button 
                variant="outline" 
                className="px-8 py-6 text-lg border-2 hover:bg-gray-50"
              >
                View Full Curriculum
              </Button>
            </Link>
          </motion.div>
        </motion.div>

        {/* Program Overview with Cards */}
        <section className="mx-auto w-full max-w-6xl mt-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              What Makes This Different
            </h2>
            <p className="text-gray-600 text-lg max-w-3xl mx-auto">
              AI Vibe Coding isn&apos;t just about code — it&apos;s about creating with energy, 
              scaling with AI, and thinking like an entrepreneur.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="hover:shadow-lg transition-shadow duration-200 border-0 bg-gradient-to-br from-blue-50 to-white">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
                  <Calendar className="w-6 h-6 text-blue-700" />
                </div>
                <h3 className="font-semibold text-lg mb-2">Weekend Workshops</h3>
                <p className="text-gray-600 text-sm">5 intensive 2-hour sessions where you build live alongside peers</p>
              </CardContent>
            </Card>
            
            <Card className="hover:shadow-lg transition-shadow duration-200 border-0 bg-gradient-to-br from-purple-50 to-white">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-4">
                  <Users className="w-6 h-6 text-purple-700" />
                </div>
                <h3 className="font-semibold text-lg mb-2">Weekly Deep Dives</h3>
                <p className="text-gray-600 text-sm">1-hour sessions with Chinat for reflection & personalized mentorship</p>
              </CardContent>
            </Card>
            
            <Card className="hover:shadow-lg transition-shadow duration-200 border-0 bg-gradient-to-br from-green-50 to-white">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-4">
                  <Brain className="w-6 h-6 text-green-700" />
                </div>
                <h3 className="font-semibold text-lg mb-2">Exclusive Frameworks</h3>
                <p className="text-gray-600 text-sm">BRICK Ladder, ALERT Risk Level, SNOW Agent Framework</p>
              </CardContent>
            </Card>
            
            <Card className="hover:shadow-lg transition-shadow duration-200 border-0 bg-gradient-to-br from-orange-50 to-white">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center mb-4">
                  <Rocket className="w-6 h-6 text-orange-700" />
                </div>
                <h3 className="font-semibold text-lg mb-2">Launch Ready</h3>
                <p className="text-gray-600 text-sm">Go from prototype to market-ready product in 5 weeks</p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Curriculum Timeline */}
        <section id="curriculum" className="mx-auto w-full max-w-6xl mt-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              Your 5-Week Journey
            </h2>
            <p className="text-gray-600 text-lg max-w-3xl mx-auto">
              Each week builds on the last, taking you from spark to scale
            </p>
          </div>

          <div className="relative">
            {/* Timeline line */}
            <div className="hidden md:block absolute left-1/2 transform -translate-x-1/2 w-1 h-full bg-gradient-to-b from-blue-200 via-purple-200 to-green-200" />
            
            <div className="space-y-8">
              {[
                {
                  week: 1,
                  title: "The BRICK Vibe Coding Ladder",
                  description: "Master structured creativity: climb from spark → prototype → execution",
                  icon: <Code className="w-6 h-6" />,
                  bgClass: "bg-gradient-to-br from-blue-50 to-white",
                  iconBgClass: "bg-blue-100",
                  iconTextClass: "text-blue-700"
                },
                {
                  week: 2,
                  title: "ALERT Risk Level",
                  description: "Push innovation while managing risks with intelligent guardrails",
                  icon: <Zap className="w-6 h-6" />,
                  bgClass: "bg-gradient-to-br from-purple-50 to-white",
                  iconBgClass: "bg-purple-100",
                  iconTextClass: "text-purple-700"
                },
                {
                  week: 3,
                  title: "SNOW Agent Framework",
                  description: "Design adaptive, responsive AI agents that feel alive and intelligent",
                  icon: <Brain className="w-6 h-6" />,
                  bgClass: "bg-gradient-to-br from-indigo-50 to-white",
                  iconBgClass: "bg-indigo-100",
                  iconTextClass: "text-indigo-700"
                },
                {
                  week: 4,
                  title: "Cloud Parallelization",
                  description: "Scale your work: orchestrate multiple agents in parallel cloud workflows",
                  icon: <Rocket className="w-6 h-6" />,
                  bgClass: "bg-gradient-to-br from-green-50 to-white",
                  iconBgClass: "bg-green-100",
                  iconTextClass: "text-green-700"
                },
                {
                  week: 5,
                  title: "Go-To-Market & Launch",
                  description: "Transform prototypes into products. Pitch, validate, and embody the entrepreneur mindset",
                  icon: <Award className="w-6 h-6" />,
                  bgClass: "bg-gradient-to-br from-orange-50 to-white",
                  iconBgClass: "bg-orange-100",
                  iconTextClass: "text-orange-700"
                }
              ].map((item, index) => (
                <motion.div 
                  key={item.week}
                  className={`relative flex flex-col md:flex-row items-center gap-6 ${
                    index % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'
                  }`}
                  onHoverStart={() => setHoveredWeek(item.week)}
                  onHoverEnd={() => setHoveredWeek(null)}
                  whileHover={{ scale: 1.02 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <div className={`flex-1 ${index % 2 === 0 ? 'md:text-right' : 'md:text-left'}`}>
                    <Card className={`
                      hover:shadow-xl transition-all duration-300 border-0
                      ${hoveredWeek === item.week ? 'shadow-xl' : 'shadow-md'}
                      ${item.bgClass}
                    `}>
                      <CardContent className="p-6">
                        <div className={`flex items-center gap-3 mb-3 ${
                          index % 2 === 0 ? 'md:justify-end' : 'md:justify-start'
                        }`}>
                          <div className={`
                            w-10 h-10 rounded-full flex items-center justify-center
                            ${item.iconBgClass} ${item.iconTextClass}
                          `}>
                            {item.icon}
                          </div>
                          <span className="text-sm font-semibold text-gray-500">WEEK {item.week}</span>
                        </div>
                        <h3 className="font-bold text-xl mb-2">{item.title}</h3>
                        <p className="text-gray-600">{item.description}</p>
                      </CardContent>
                    </Card>
                  </div>
                  
                  {/* Timeline dot */}
                  <div className="hidden md:flex absolute left-1/2 transform -translate-x-1/2 w-4 h-4 bg-white border-4 border-blue-500 rounded-full z-10" />
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Why Join Section with Icons */}
        <section className="mx-auto w-full max-w-6xl mt-20">
          <div className="bg-gradient-to-r from-blue-900 to-purple-900 rounded-3xl p-12 text-white">
            <h2 className="text-center text-3xl sm:text-4xl font-bold tracking-tight mb-8">
              Why Top Builders Choose This Program
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { icon: <CheckCircle />, text: "Hands-on: Build real projects, not just theory" },
                { icon: <Users />, text: "Personalized: Only 12 seats for deep interaction" },
                { icon: <Rocket />, text: "End-to-End: From coding vibes to launching ventures" },
                { icon: <Star />, text: "Mentorship: Weekly 1:1 guidance with Chinat" }
              ].map((item, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="text-blue-300 mt-1">{item.icon}</div>
                  <p className="text-white/90">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing Section with Premium Feel */}
        <section id="reserve" className="mx-auto w-full max-w-6xl mt-20">
          <div className="text-center">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-8">
              Investment in Your Future
            </h2>
            
            <Card className="max-w-2xl mx-auto border-0 shadow-2xl bg-gradient-to-br from-white to-gray-50">
              <CardContent className="p-12">
                <div className="mb-6">
                  <div className="text-5xl font-bold text-blue-900 mb-2">$2,500</div>
                  <p className="text-gray-600">One-time investment</p>
                </div>
                
                <div className="space-y-3 mb-8 text-left max-w-md mx-auto">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <span className="text-gray-700">All 5 weekend workshops (10+ hours)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <span className="text-gray-700">Weekly 1-hour deep dive sessions</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <span className="text-gray-700">Exclusive frameworks & resources</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <span className="text-gray-700">Lifetime community access</span>
                  </div>
                </div>
                
                <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-xl p-4 mb-6">
                  <div className="flex items-center gap-2 text-orange-800">
                    <Clock className="w-5 h-5" />
                    <span className="font-semibold">Early Bird Bonus</span>
                  </div>
                  <p className="text-sm text-orange-700 mt-1">
                    Sign up now and get a 30-minute 1:1 strategy session with Chinat
                  </p>
                </div>
                
                <Link href="/ai-vibe-masterclass/checkout">
                  <Button 
                    variant="default" 
                    className="w-full py-6 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
                  >
                    Secure Your Seat Now
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Who Is This For - Visual Cards */}
        <section className="mx-auto w-full max-w-6xl mt-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              Perfect For Ambitious Builders
            </h2>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="hover:shadow-lg transition-shadow duration-200 border-2 border-transparent hover:border-blue-200">
              <CardContent className="p-6">
                <div className="text-4xl mb-4">🚀</div>
                <h3 className="font-semibold text-lg mb-2">Aspiring Entrepreneurs</h3>
                <p className="text-gray-600">Ready to scale from idea to product with AI-powered innovation</p>
              </CardContent>
            </Card>
            
            <Card className="hover:shadow-lg transition-shadow duration-200 border-2 border-transparent hover:border-purple-200">
              <CardContent className="p-6">
                <div className="text-4xl mb-4">💡</div>
                <h3 className="font-semibold text-lg mb-2">Creative Hackers</h3>
                <p className="text-gray-600">Interested in blending coding skills with entrepreneurial thinking</p>
              </CardContent>
            </Card>
            
            <Card className="hover:shadow-lg transition-shadow duration-200 border-2 border-transparent hover:border-green-200">
              <CardContent className="p-6">
                <div className="text-4xl mb-4">🎯</div>
                <h3 className="font-semibold text-lg mb-2">Early-Stage Founders</h3>
                <p className="text-gray-600">Looking to apply AI in practical, market-ready ways</p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* FAQ with Accordion Style */}
        <section className="mx-auto w-full max-w-4xl mt-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              Frequently Asked Questions
            </h2>
          </div>
          
          <div className="space-y-4">
            {[
              {
                q: "Do I need a coding background?",
                a: "Some coding experience helps, but this program focuses equally on creativity and entrepreneurship. If you can write basic code and are eager to learn, you'll thrive."
              },
              {
                q: "Will I launch a startup by the end?",
                a: "You'll have all the skills, frameworks, and confidence needed to take your projects to market. Many students continue developing their projects post-program with ongoing support."
              },
              {
                q: "Can I use my own project idea?",
                a: "Absolutely! The frameworks are designed to apply directly to your unique ideas. You'll get personalized feedback on your specific project."
              },
              {
                q: "What's the time commitment?",
                a: "Plan for 3-4 hours per week: 2-hour weekend workshop + 1-hour deep dive + some practice time. The program is designed for busy professionals."
              },
              {
                q: "Is there ongoing support after the program?",
                a: "Yes! You'll have lifetime access to the community and resources, plus alumni get priority access to future programs and events."
              }
            ].map((item, index) => (
              <Card key={index} className="hover:shadow-md transition-shadow duration-200">
                <CardContent className="p-6">
                  <h3 className="font-semibold text-lg mb-2">{item.q}</h3>
                  <p className="text-gray-600">{item.a}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Final CTA with Urgency */}
        <section className="mx-auto w-full max-w-6xl mt-20">
          <Card className="border-0 shadow-2xl bg-gradient-to-r from-blue-600 to-purple-600 text-white overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full filter blur-3xl" />
            <CardContent className="relative p-12 text-center">
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
                Ready to Transform Your Coding Journey?
              </h2>
              <p className="text-xl mb-8 text-white/90 max-w-2xl mx-auto">
                12 Seats. 5 Weeks. Code, Scale, Launch.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-8">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  <span className="font-semibold">Only 3 seats remaining</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  <span className="font-semibold">Starting next week</span>
                </div>
              </div>
              
              <Link href="/ai-vibe-masterclass/checkout">
                <Button 
                  variant="default"
                  className="bg-white text-blue-900 hover:bg-gray-100 px-10 py-6 text-lg font-bold shadow-xl hover:shadow-2xl transition-all duration-200"
                >
                  Reserve Your Seat Now
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </section>
      </div>

      <Footer />
    </section>
  );
}