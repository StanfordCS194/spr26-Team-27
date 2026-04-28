import logoWithIcon from "@/assets/InLectureLogoWithIcon.svg";
import wordmark from "@/assets/InLectureWordmark.svg";
import FeatureCard from "@/components/landingPage/FeatureCard";
import HowItWorksItem from "@/components/landingPage/HowItWorksItem";
import { PrimaryLink } from "@/components/landingPage/PrimaryLink";
import {
  AccentText,
  SectionContainer,
  SectionDescription,
  SectionHeading,
  SectionSubheading,
} from "@/components/landingPage/Section";
import WhoItsForCard from "@/components/landingPage/WhoItsForCard";

function LandingPage() {
  return (
    <div className="bg-primary-contr flex flex-col items-center justify-center">
      {/* Navbar */}

      <div className="border-divider flex w-full flex-1 items-center border-b px-6 py-4">
        <img className="h-8" src={logoWithIcon} alt="InLecture Logo" />
        <div></div>
      </div>

      {/* Hero */}

      <SectionContainer>
        <div className="flex flex-col items-center justify-center gap-8">
          <h1 className="font-display text-primary text-hero max-w-md text-center font-bold md:max-w-148 lg:max-w-3xl">
            Your lecture, <AccentText>understood</AccentText> in real time
          </h1>
          <p className="text-secondary text-title max-w-2xl text-center md:max-w-3xl lg:max-w-4xl">
            InLecture is the AI companion that follows every word of your class
            — so you can ask questions, get clarity, and stay engaged in a 300+
            person auditorium.
          </p>
          <PrimaryLink to="/learn/$courseId" params={{ courseId: "cs-109" }}>
            Try it now
          </PrimaryLink>
        </div>
      </SectionContainer>

      {/* Features Section */}

      <SectionContainer>
        <SectionHeading>Features</SectionHeading>
        <SectionSubheading>
          Built for the <AccentText>live</AccentText> lecture experience
        </SectionSubheading>
        <SectionDescription>
          InLecture isn't a static chatbot. It knows what slide you're on, what
          your professor just said, and how today's content connects to Week 1.
        </SectionDescription>
        <div className="grid auto-rows-fr grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
          <FeatureCard
            icon={"🎙️"}
            feature="Real-time audio understanding"
            description="InLecture listens to your instructor's live audio and tracks the conversation of the lecture as it evolves — so context is always current, never stale."
          />
          <FeatureCard
            icon={"📄"}
            feature="Slide and material grounding"
            description="You or your instructor can upload the course slides and notes. Every answer is grounded in your course's actual materials — not generic web results or hallucinated content."
          />
          <FeatureCard
            icon={"💬"}
            feature="Private Q&A, instant answers"
            description="Ask what you need, when you need it. Your questions stay between you and InLecture. Just clear answers in the moment."
          />
          <FeatureCard
            icon={"🔗"}
            feature="Cross-lecture connections"
            description="InLecture knows your course history. Ask how today's topic connects to last week's lecture and get answers that actually make sense."
          />
          <FeatureCard
            icon={"📊"}
            feature="Concept Checks"
            description="Instructors can push short prompts and comprehension checks directly to student devices — turning any lecture hall into an interactive classroom."
          />
          <FeatureCard
            icon={"📱"}
            feature="Laptop, tablet, or phone"
            description="Works wherever students already are. No special hardware, no new apps to install. InLecture meets you in your seat."
          />
        </div>
      </SectionContainer>

      {/* How it Works Section */}
      <SectionContainer contrast={true}>
        <SectionHeading contrast={true}>How it Works</SectionHeading>
        <SectionSubheading contrast={true}>
          Three layers of context, <AccentText contrast={true}>one</AccentText>{" "}
          companion
        </SectionSubheading>
        <SectionDescription contrast={true}>
          InLecture builds a complete understanding of your lecture by combining
          materials, real-time audio, and course history.
        </SectionDescription>
        <div className="flex flex-col gap-12">
          <HowItWorksItem
            idx={1}
            title="Upload your course materials"
            description="Add your lecture slides, readings, and syllabi at the start of the term. InLecture indexes everything so responses are grounded in your specific curriculum — not the internet."
          />
          <HowItWorksItem
            idx={2}
            title="InLecture follows the live lecture"
            description="During class, InLecture captures real-time audio from the instructor. It knows which slide you're on, what concept is being discussed, and how it connects to prior lectures."
          />
          <HowItWorksItem
            idx={3}
            title="Ask anything, get grounded answers"
            description="Type a question on your device. InLecture responds with an explanation anchored in what's happening right now — not a generic textbook definition."
          />
          <HowItWorksItem
            idx={4}
            title="Instructors drive engagement"
            description="Professors can push concept checks, polls, and prompts to every student's device mid-lecture — creating active learning moments without disrupting the natural flow of class."
          />
        </div>
      </SectionContainer>

      {/* Who It's For Section */}
      <SectionContainer>
        <SectionHeading>Who It's For</SectionHeading>
        <SectionSubheading>
          For students <AccentText>and</AccentText> instructors
        </SectionSubheading>
        <SectionDescription>
          InLecture is designed to work for both sides of the lecture hall —
          without getting in the way of learning or teaching.
        </SectionDescription>
        <div className="grid auto-rows-fr grid-cols-1 gap-6 md:grid-cols-2">
          <WhoItsForCard
            who="Students"
            title="Never feel lost in a large lecture again"
            description="InLecture is your private AI companion that understands exactly what your professor is teaching — and explains it in terms of your own course material."
            features={[
              { id: "1", feature: "Ask questions as soon as you need to" },
              {
                id: "2",
                feature: "Get clarifications grounded in your slides",
              },
              { id: "3", feature: "Connect today's topic to earlier lectures" },
              { id: "4", feature: "Works on your phone, tablet, or laptop" },
            ]}
          />
          <WhoItsForCard
            who="Instructors"
            title="Turn any lecture hall into an active classroom"
            description="InLecture gives you new tools to gauge understanding and involve students — without restructuring your teaching or sacrificing content coverage."
            features={[
              { id: "1", feature: "Push concept checks to student devices" },
              { id: "2", feature: "Get anonymized comprehension signals" },
              { id: "3", feature: "Works alongside your existing slides" },
              { id: "4", feature: "No new apps to install" },
            ]}
          />
        </div>
      </SectionContainer>

      {/* Get Started Section */}
      <SectionContainer center={true} contrast={true}>
        <SectionHeading center={true} contrast={true}>
          Get Started
        </SectionHeading>
        <SectionSubheading center={true} contrast={true}>
          Ready to make every lecture{" "}
          <AccentText contrast={true}>count</AccentText>?
        </SectionSubheading>
        <SectionDescription center={true} contrast={true}>
          InLecture is currently in development. Sign up to get early access and
          help help us shape the future of AI in the classroom.
        </SectionDescription>
        <PrimaryLink to="/learn/$courseId" params={{ courseId: "cs-109" }}>
          Try it out!
        </PrimaryLink>
      </SectionContainer>

      {/* Footer */}
      <div className="bg-footer-bg flex w-full items-start justify-between px-6 py-4 sm:items-center">
        <div className="pt-1">
          <img src={wordmark} alt="InLecture Logo" className="w-28" />
        </div>
        <div className="flex items-center">
          <p className="text-secondary-contr text-body text-right">
            © 2026 InLecture. Your favorite class companion ✦
          </p>
        </div>
      </div>
    </div>
  );
}

export default LandingPage;
