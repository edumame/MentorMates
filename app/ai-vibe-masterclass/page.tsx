import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/layout/Footer";
import { BackgroundBeams } from "@/components/ui/background-beams";
import { SparklesCore } from "@/components/ui/sparkles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Zap,
  Users,
  Target,
  Trophy,
  Calendar,
  DollarSign,
  CheckCircle,
  Star,
  ArrowRight,
  BookOpen,
  Lightbulb,
  Rocket,
  Brain,
  Code,
  TrendingUp,
  Clock
} from "lucide-react";

export const metadata: Metadata = {
  title: "AI Vibe Coding Masterclass | MentorMates",
  description:
    "A 5-week, high-impact masterclass blending AI, code, and entrepreneurial energy. Only 12 seats. $2,500.",
};

export default function AIVibeMasterclassPage() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-white via-blue-50/30 to-purple-50/20">
      <BackgroundBeams className="absolute inset-0" />

      {/* Sparkles Background */}
      <div className="absolute inset-0 overflow-hidden">
        <SparklesCore
          id="hero-sparkles"
          background="transparent"
          minSize={0.6}
          maxSize={1.4}
          particleDensity={100}
          className="w-full h-full"
          particleColor="#6366f1"
        />
      </div>

      <div className="relative z-10 px-5 py-8 md:py-16">
        {/* Hero */}
        <div className="max-w-6xl mx-auto text-center">
          <div className="relative mx-auto w-full max-w-4xl overflow-hidden rounded-2xl shadow-2xl mb-12">
            <div className="relative pt-[56.25%]">
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

          {/* Hero Content */}
          <div className="space-y-6">
            <Badge variant="secondary" className="bg-gradient-to-r from-purple-500 to-blue-600 text-white px-4 py-2 text-sm font-semibold">
              🔥 Limited to 12 Participants
            </Badge>

            <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight bg-gradient-to-r from-gray-900 via-purple-800 to-blue-800 bg-clip-text text-transparent leading-tight">
              Unlock Your AI Vibe:
              <br />
              <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                Master Coding, Agents & Entrepreneurship
              </span>
            </h1>

            <p className="text-gray-700 mt-6 text-lg md:text-xl max-w-4xl mx-auto leading-relaxed">
              A 5-week, high-impact masterclass blending AI, code, and entrepreneurial energy.
              Transform your ideas into scalable ventures with cutting-edge frameworks and personalized mentorship.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-600">
                <Clock className="w-4 h-4 text-purple-600" />
                <span>5 Weeks Intensive</span>
              </div>
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-600">
                <Users className="w-4 h-4 text-blue-600" />
                <span>12 Seats Only</span>
              </div>
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-600">
                <DollarSign className="w-4 h-4 text-green-600" />
                <span>$2,500 Investment</span>
              </div>
            </div>

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/ai-vibe-masterclass/checkout">
                <Button size="lg" className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-8 py-4 text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300">
                  Reserve Your Seat Now
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
              <p className="text-sm text-gray-500 font-medium">
                ⚡ Early bird bonus: 30-min 1:1 with Chinat
              </p>
            </div>
          </div>
        </div>

        {/* Program Overview */}
        <section className="mx-auto w-full max-w-6xl mt-20">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4 border-purple-200 text-purple-700 bg-purple-50">
              <Target className="w-3 h-3 mr-1" />
              Program Overview
            </Badge>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-6">
              Transform Your Ideas Into Scalable Ventures
            </h2>
            <p className="text-gray-600 text-lg md:text-xl max-w-4xl mx-auto leading-relaxed">
              AI Vibe Coding isn’t just about code — it’s about creating with energy, scaling with AI, and thinking like an entrepreneur.
              In 5 weeks, you’ll climb the BRICK Vibe Coding Ladder, build cloud-powered agents, and prepare to launch with confidence.
            </p>
          </div>

          {/* Key Features Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50 to-blue-50 hover:shadow-xl transition-all duration-300">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Calendar className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">5 Weekend Workshops</h3>
                <p className="text-sm text-gray-600">2 hours each - Build live projects</p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-cyan-50 hover:shadow-xl transition-all duration-300">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Weekly Deep Dives</h3>
                <p className="text-sm text-gray-600">1 hour with Chinat - Personal mentorship</p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg bg-gradient-to-br from-cyan-50 to-green-50 hover:shadow-xl transition-all duration-300">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-gradient-to-r from-cyan-500 to-green-500 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <BookOpen className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Exclusive Frameworks</h3>
                <p className="text-sm text-gray-600">BRICK Ladder, ALERT Risk Level, SNOW Agents</p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-purple-50 hover:shadow-xl transition-all duration-300">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-purple-500 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Trophy className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Elite Community</h3>
                <p className="text-sm text-gray-600">Only 12 participants - High-touch learning</p>
              </CardContent>
            </Card>
          </div>

          {/* What You'll Get */}
          <Card className="border-0 shadow-xl bg-gradient-to-r from-white via-purple-50/50 to-blue-50/50">
            <CardHeader className="text-center pb-6">
              <CardTitle className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                What You'll Master
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Brain className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">AI-First Thinking</h3>
                  <p className="text-sm text-gray-600">Develop an entrepreneurial mindset powered by AI</p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Code className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">Advanced Coding</h3>
                  <p className="text-sm text-gray-600">Build sophisticated agents and cloud architectures</p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-r from-cyan-500 to-green-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Rocket className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">Launch Ready</h3>
                  <p className="text-sm text-gray-600">Go-to-market strategies and business frameworks</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Curriculum Breakdown */}
        <section className="mx-auto w-full max-w-6xl mt-20">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4 border-blue-200 text-blue-700 bg-blue-50">
              <BookOpen className="w-3 h-3 mr-1" />
              Week-by-Week Journey
            </Badge>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-6">
              Your 5-Week Transformation
            </h2>
            <p className="text-gray-600 text-lg md:text-xl max-w-4xl mx-auto leading-relaxed">
              Each week builds on the last, taking you from creative spark to market-ready venture
            </p>
          </div>

          <div className="relative">
            {/* Timeline Line */}
            <div className="absolute left-8 md:left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-purple-500 via-blue-500 to-green-500 transform md:-translate-x-0.5"></div>

            <div className="space-y-8">
              {/* Week 1 */}
              <div className="relative flex items-center">
                <div className="flex-shrink-0 w-16 h-16 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center shadow-lg">
                  <span className="text-white font-bold text-lg">1</span>
                </div>
                <Card className="ml-8 md:ml-0 md:w-5/12 border-0 shadow-xl bg-gradient-to-r from-white to-purple-50/50">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-3">
                      <Lightbulb className="w-5 h-5 text-purple-600" />
                      <h3 className="font-bold text-lg text-gray-900">The BRICK Vibe Coding Ladder</h3>
                    </div>
                    <p className="text-gray-600 leading-relaxed">
                      Master the foundation: climb from creative spark → structured prototype → flawless execution using our proven methodology.
                    </p>
                    <Badge variant="outline" className="mt-3 border-purple-200 text-purple-700">
                      Foundation Building
                    </Badge>
                  </CardContent>
                </Card>
              </div>

              {/* Week 2 */}
              <div className="relative flex items-center md:flex-row-reverse">
                <div className="flex-shrink-0 w-16 h-16 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center shadow-lg">
                  <span className="text-white font-bold text-lg">2</span>
                </div>
                <Card className="ml-8 md:ml-0 md:mr-8 md:w-5/12 border-0 shadow-xl bg-gradient-to-r from-white to-blue-50/50">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-3">
                      <Target className="w-5 h-5 text-blue-600" />
                      <h3 className="font-bold text-lg text-gray-900">ALERT Risk Level Framework</h3>
                    </div>
                    <p className="text-gray-600 leading-relaxed">
                      Learn to push boundaries safely. Master innovation while implementing smart guardrails and risk management.
                    </p>
                    <Badge variant="outline" className="mt-3 border-blue-200 text-blue-700">
                      Risk Management
                    </Badge>
                  </CardContent>
                </Card>
              </div>

              {/* Week 3 */}
              <div className="relative flex items-center">
                <div className="flex-shrink-0 w-16 h-16 bg-gradient-to-r from-cyan-500 to-green-500 rounded-full flex items-center justify-center shadow-lg">
                  <span className="text-white font-bold text-lg">3</span>
                </div>
                <Card className="ml-8 md:ml-0 md:w-5/12 border-0 shadow-xl bg-gradient-to-r from-white to-cyan-50/50">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-3">
                      <Brain className="w-5 h-5 text-cyan-600" />
                      <h3 className="font-bold text-lg text-gray-900">SNOW Agent Framework</h3>
                    </div>
                    <p className="text-gray-600 leading-relaxed">
                      Design adaptive, responsive AI agents that feel alive. Create systems that learn and evolve with your users.
                    </p>
                    <Badge variant="outline" className="mt-3 border-cyan-200 text-cyan-700">
                      AI Architecture
                    </Badge>
                  </CardContent>
                </Card>
              </div>

              {/* Week 4 */}
              <div className="relative flex items-center md:flex-row-reverse">
                <div className="flex-shrink-0 w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center shadow-lg">
                  <span className="text-white font-bold text-lg">4</span>
                </div>
                <Card className="ml-8 md:ml-0 md:mr-8 md:w-5/12 border-0 shadow-xl bg-gradient-to-r from-white to-green-50/50">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-3">
                      <Zap className="w-5 h-5 text-green-600" />
                      <h3 className="font-bold text-lg text-gray-900">Cloud Agent Parallelization</h3>
                    </div>
                    <p className="text-gray-600 leading-relaxed">
                      Scale exponentially: orchestrate multiple agents in the cloud, experiment with parallel workflows and distributed systems.
                    </p>
                    <Badge variant="outline" className="mt-3 border-green-200 text-green-700">
                      Advanced Scaling
                    </Badge>
                  </CardContent>
                </Card>
              </div>

              {/* Week 5 */}
              <div className="relative flex items-center">
                <div className="flex-shrink-0 w-16 h-16 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center shadow-lg">
                  <span className="text-white font-bold text-lg">5</span>
                </div>
                <Card className="ml-8 md:ml-0 md:w-5/12 border-0 shadow-xl bg-gradient-to-r from-white via-purple-50/50 to-pink-50/50">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-3">
                      <Rocket className="w-5 h-5 text-purple-600" />
                      <h3 className="font-bold text-lg text-gray-900">Launch & Entrepreneur Mindset</h3>
                    </div>
                    <p className="text-gray-600 leading-relaxed">
                      Transform prototypes into market-ready products. Master pitching, market validation, and the complete entrepreneur journey.
                    </p>
                    <Badge variant="outline" className="mt-3 border-purple-200 text-purple-700">
                      Go-to-Market
                    </Badge>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* Why Join & Testimonials */}
        <section className="mx-auto w-full max-w-6xl mt-20">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4 border-green-200 text-green-700 bg-green-50">
              <Star className="w-3 h-3 mr-1" />
              Why Choose AI Vibe?
            </Badge>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-6">
              The AI Vibe Difference
            </h2>
            <p className="text-gray-600 text-lg md:text-xl max-w-4xl mx-auto leading-relaxed">
              Join an exclusive community of builders who are shaping the future of AI-powered entrepreneurship
            </p>
          </div>

          {/* Why Join Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-emerald-50 hover:shadow-xl transition-all duration-300">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Hands-On Learning</h3>
                <p className="text-sm text-gray-600">Build real projects, not just theory</p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg bg-gradient-to-br from-emerald-50 to-teal-50 hover:shadow-xl transition-all duration-300">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Elite Community</h3>
                <p className="text-sm text-gray-600">Only 12 participants for deep interaction</p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg bg-gradient-to-br from-teal-50 to-cyan-50 hover:shadow-xl transition-all duration-300">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-gradient-to-r from-teal-500 to-cyan-500 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Rocket className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Complete Journey</h3>
                <p className="text-sm text-gray-600">From concept to market-ready venture</p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg bg-gradient-to-br from-cyan-50 to-blue-50 hover:shadow-xl transition-all duration-300">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Trophy className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Expert Mentorship</h3>
                <p className="text-sm text-gray-600">Weekly guidance from industry leaders</p>
              </CardContent>
            </Card>
          </div>

          {/* Social Proof Section */}
          <Card className="border-0 shadow-xl bg-gradient-to-r from-white via-blue-50/30 to-purple-50/30 mb-12">
            <CardHeader className="text-center pb-6">
              <CardTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                What Our Community Says
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid md:grid-cols-3 gap-6">
                <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-gray-100">
                  <div className="flex items-center mb-4">
                    <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-semibold text-sm">S</span>
                    </div>
                    <div className="ml-3">
                      <h4 className="font-semibold text-gray-900">Sarah Chen</h4>
                      <p className="text-sm text-gray-600">Startup Founder</p>
                    </div>
                  </div>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    "AI Vibe transformed how I think about building products. The frameworks are game-changing."
                  </p>
                  <div className="flex text-yellow-400 mt-2">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-current" />
                    ))}
                  </div>
                </div>

                <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-gray-100">
                  <div className="flex items-center mb-4">
                    <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-semibold text-sm">M</span>
                    </div>
                    <div className="ml-3">
                      <h4 className="font-semibold text-gray-900">Marcus Rodriguez</h4>
                      <p className="text-sm text-gray-600">AI Engineer</p>
                    </div>
                  </div>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    "The mentorship and community support is incredible. I launched my AI startup within weeks."
                  </p>
                  <div className="flex text-yellow-400 mt-2">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-current" />
                    ))}
                  </div>
                </div>

                <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-gray-100">
                  <div className="flex items-center mb-4">
                    <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-teal-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-semibold text-sm">A</span>
                    </div>
                    <div className="ml-3">
                      <h4 className="font-semibold text-gray-900">Alex Thompson</h4>
                      <p className="text-sm text-gray-600">Product Manager</p>
                    </div>
                  </div>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    "Finally, a program that bridges the gap between AI development and business strategy."
                  </p>
                  <div className="flex text-yellow-400 mt-2">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-current" />
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Pricing Section */}
        <section id="reserve" className="mx-auto w-full max-w-6xl mt-20">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4 border-orange-200 text-orange-700 bg-orange-50">
              <DollarSign className="w-3 h-3 mr-1" />
              Investment & Pricing
            </Badge>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-6">
              Your Investment in the Future
            </h2>
            <p className="text-gray-600 text-lg md:text-xl max-w-4xl mx-auto leading-relaxed">
              A premium experience designed for serious entrepreneurs and builders ready to scale
            </p>
          </div>

          {/* Pricing Cards */}
          <div className="max-w-2xl mx-auto mb-8">
            <Card className="border-0 shadow-2xl bg-gradient-to-br from-white via-orange-50/20 to-red-50/20 relative overflow-hidden">
              <div className="absolute top-4 right-4">
                <Badge className="bg-gradient-to-r from-orange-500 to-red-500 text-white">
                  🔥 Limited Time
                </Badge>
              </div>

              <CardHeader className="text-center pb-6">
                <CardTitle className="text-2xl font-bold text-gray-900 mb-4">
                  Complete AI Vibe Masterclass
                </CardTitle>
                <div className="mb-6">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <span className="text-4xl font-bold text-gray-400 line-through">$3,500</span>
                    <Badge variant="secondary" className="bg-green-500 text-white px-3 py-1">
                      Save $1,000
                    </Badge>
                  </div>
                  <div className="text-6xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent mb-2">
                    $2,500
                  </div>
                  <p className="text-gray-600">One-time investment</p>
                </div>
              </CardHeader>

              <CardContent className="pt-0">
                <div className="space-y-4 mb-8">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="text-gray-700">5 Weekend Workshops (10 hours total)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="text-gray-700">5 Weekly Deep Dives with Chinat (5 hours)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="text-gray-700">Exclusive Frameworks: BRICK, ALERT, SNOW</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="text-gray-700">Private community access (12 members only)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="text-gray-700">Lifetime access to course materials</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="text-gray-700 font-semibold">Bonus: 30-min 1:1 strategy session</span>
                  </div>
                </div>

                {/* Urgency Section */}
                <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-xl p-6 mb-8">
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <Clock className="w-5 h-5 text-orange-600" />
                    <h3 className="font-semibold text-orange-900">Limited Availability</h3>
                  </div>
                  <p className="text-orange-700 text-sm mb-4">
                    Only 12 seats available for this cohort. 7 spots remaining.
                  </p>
                  <div className="w-full bg-orange-200 rounded-full h-2 mb-2">
                    <div className="bg-gradient-to-r from-orange-500 to-red-500 h-2 rounded-full" style={{ width: '58%' }}></div>
                  </div>
                  <p className="text-xs text-orange-600">Next cohort: Q2 2025 (Price increase expected)</p>
                </div>

                <div className="text-center">
                  <Link href="/ai-vibe-masterclass/checkout">
                    <Button size="lg" className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-12 py-4 text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 mb-4">
                      Secure Your Spot Now
                      <ArrowRight className="ml-2 w-5 h-5" />
                    </Button>
                  </Link>
                  <p className="text-sm text-gray-500">
                    💳 30-day money-back guarantee • 📧 Instant confirmation
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* FAQ Section */}
          <div className="text-center">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Have Questions?</h3>
            <p className="text-gray-600 mb-6">
              Here are answers to the most common questions about the program
            </p>
            <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              <Card className="border-0 shadow-lg bg-white/80">
                <CardContent className="p-6">
                  <h4 className="font-semibold text-gray-900 mb-2">Do I need coding experience?</h4>
                  <p className="text-gray-600 text-sm">Basic coding knowledge helps, but this program focuses on creativity and entrepreneurship as much as technical skills.</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-lg bg-white/80">
                <CardContent className="p-6">
                  <h4 className="font-semibold text-gray-900 mb-2">Will I launch a startup?</h4>
                  <p className="text-gray-600 text-sm">You'll gain the frameworks and mindset to launch ventures, with many participants starting companies during or immediately after the program.</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Who Is This For */}
        <section className="mx-auto w-full max-w-6xl mt-20">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4 border-purple-200 text-purple-700 bg-purple-50">
              <Users className="w-3 h-3 mr-1" />
              Perfect For
            </Badge>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-6">
              Is This Program Right for You?
            </h2>
            <p className="text-gray-600 text-lg md:text-xl max-w-4xl mx-auto leading-relaxed">
              Join if you're ready to transform your ideas into scalable, AI-powered ventures
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50 to-blue-50">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Rocket className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-3">Ambitious Builders</h3>
                <p className="text-sm text-gray-600 mb-4">Ready to scale from idea to market-ready product</p>
                <ul className="text-xs text-gray-500 space-y-1">
                  <li>• Product managers</li>
                  <li>• Startup founders</li>
                  <li>• Innovation leads</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-cyan-50">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Code className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-3">Creative Technologists</h3>
                <p className="text-sm text-gray-600 mb-4">Combining code with entrepreneurial vision</p>
                <ul className="text-xs text-gray-500 space-y-1">
                  <li>• AI/ML engineers</li>
                  <li>• Full-stack developers</li>
                  <li>• Tech entrepreneurs</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg bg-gradient-to-br from-cyan-50 to-green-50">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-gradient-to-r from-cyan-500 to-green-500 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-3">Future Leaders</h3>
                <p className="text-sm text-gray-600 mb-4">Students and professionals ready for AI transformation</p>
                <ul className="text-xs text-gray-500 space-y-1">
                  <li>• CS students</li>
                  <li>• Career changers</li>
                  <li>• Innovation teams</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Final CTA */}
        <section className="mx-auto w-full max-w-6xl mt-20 mb-12">
          <Card className="border-0 shadow-2xl bg-gradient-to-r from-purple-600 via-blue-600 to-cyan-600 text-white relative overflow-hidden">
            <div className="absolute inset-0 bg-black/10"></div>
            <CardContent className="relative z-10 p-12 text-center">
              <div className="mb-6">
                <Badge className="bg-white/20 text-white border-white/30 mb-4 px-4 py-2">
                  ⏰ Don't Miss Out
                </Badge>
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
                  Ready to Transform Your Future?
                </h2>
                <p className="text-xl opacity-90 mb-8 max-w-2xl mx-auto">
                  Join the exclusive cohort of AI entrepreneurs and builders. Only 7 spots remain.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
                <div className="flex items-center gap-2 text-lg font-semibold">
                  <span className="text-2xl">🚀</span>
                  <span>5 Weeks</span>
                </div>
                <div className="flex items-center gap-2 text-lg font-semibold">
                  <span className="text-2xl">👥</span>
                  <span>12 Elite Members</span>
                </div>
                <div className="flex items-center gap-2 text-lg font-semibold">
                  <span className="text-2xl">💰</span>
                  <span>$2,500 Investment</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/ai-vibe-masterclass/checkout">
                  <Button size="lg" className="bg-white text-purple-600 hover:bg-gray-100 px-12 py-4 text-lg font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300">
                    Reserve Your Seat Now
                    <ArrowRight className="ml-2 w-6 h-6" />
                  </Button>
                </Link>
                <p className="text-sm opacity-80">
                  ⚡ Instant access • 💳 Secure payment • 🔒 30-day guarantee
                </p>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>

      <Footer />
    </section>
  );
}

