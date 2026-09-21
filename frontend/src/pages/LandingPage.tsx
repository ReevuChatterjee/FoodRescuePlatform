import { useRef, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Leaf, ArrowDown } from 'lucide-react';
import { motion, useScroll, useTransform, useReducedMotion, MotionValue, useInView, useMotionValue, animate } from 'framer-motion';
import { ThemeToggle } from '../components/common/ThemeToggle';

export function LandingPage() {
  const prefersReducedMotion = useReducedMotion();
  const disableMotion = prefersReducedMotion === true;

  // ── Hero Scroll Parallax & Visibility ──
  const heroRef = useRef<HTMLDivElement>(null);
  const heroInView = useInView(heroRef, { margin: "0px 0px -200px 0px" });
  const { scrollY } = useScroll();
  const heroOpacity = useTransform(scrollY, [0, 400], [1, 0.4]);
  const heroY = useTransform(scrollY, [0, 400], [0, 15]);

  // ── Process Section Scroll Tracking ──
  const processRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: processScroll } = useScroll({
    target: processRef,
    offset: ["start center", "end center"]
  });

  // ── Network Section State Machine ──
  const networkRef = useRef<HTMLDivElement>(null);
  const [networkState, setNetworkState] = useState<'idle' | 'nodes_in' | 'paths_drawing' | 'loop'>('idle');
  const signalProgress = useMotionValue(0);

  useEffect(() => {
    if (disableMotion) {
      setNetworkState('loop');
      return;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setNetworkState(prev => prev === 'idle' ? 'nodes_in' : prev);
      }
    }, { threshold: 0.25 });

    if (networkRef.current) {
      observer.observe(networkRef.current);
    }

    return () => observer.disconnect();
  }, [disableMotion]);

  useEffect(() => {
    if (networkState === 'nodes_in') {
      const timer = setTimeout(() => setNetworkState('paths_drawing'), 600);
      return () => clearTimeout(timer);
    } else if (networkState === 'paths_drawing') {
      const timer = setTimeout(() => setNetworkState('loop'), 2200); // Wait for paths to draw + pause
      return () => clearTimeout(timer);
    } else if (networkState === 'loop' && !disableMotion) {
      const controls = animate(signalProgress, 1, {
        duration: 9.0,
        ease: "linear",
        repeat: Infinity,
        repeatType: "loop"
      });
      return () => controls.stop();
    } else if (disableMotion) {
      signalProgress.set(1);
    }
  }, [networkState, disableMotion, signalProgress]);

  // ── Traceability Section Scroll Tracking ──
  const traceRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: traceScroll } = useScroll({
    target: traceRef,
    offset: ["start 80%", "end 20%"]
  });
  
  const traceProgressWidth = useTransform(traceScroll, [0, 1], ["0%", "100%"]);
  const traceProgressHeight = useTransform(traceScroll, [0, 1], ["0%", "100%"]);
  
  // ── Network Progress Mapping ──
  // 7 segments: Rest(1), Travel(1->2), Rest(2), Travel(2->3), Rest(3), Travel(3->4), Rest(4)
  const networkPathOffset = useTransform(signalProgress,
    [0, 1/7, 2/7, 3/7, 4/7, 5/7, 6/7, 1],
    [0, 0,   1/3, 1/3, 2/3, 2/3, 1,   1]
  );
  
  const mobileSignalTop = useTransform(signalProgress, 
    [0, 1/7, 2/7, 3/7, 4/7, 5/7, 6/7, 1], 
    ["0%", "0%", "33.33%", "33.33%", "66.66%", "66.66%", "100%", "100%"]
  );

  const dotOpacity = useTransform(signalProgress, [0, 0.05, 0.95, 1], [0, 1, 1, 0]);

  return (
    <div className="min-h-screen flex flex-col bg-base text-on-surface">

      {/* ── Navbar ── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-surface-container border-b border-outline-variant/30">
        <div className="h-16 w-full max-w-7xl mx-auto px-4 lg:px-8 flex items-center justify-between gap-6">
          <div className="flex items-center gap-3 shrink-0">
            <Leaf size={24} className="text-primary" />
            <span className="font-semibold text-[1.125rem] text-on-surface tracking-tight">
              RePlate
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-8">
            <a href="#how-it-works" className="text-[0.875rem] font-medium text-on-surface-variant hover:text-primary transition-colors">
              How it works
            </a>
            <a href="#network-roles" className="text-[0.875rem] font-medium text-on-surface-variant hover:text-primary transition-colors">
              The Network
            </a>
            <a href="#traceability" className="text-[0.875rem] font-medium text-on-surface-variant hover:text-primary transition-colors">
              Traceability
            </a>
          </nav>

          <div className="flex items-center gap-4 shrink-0">
            <ThemeToggle />
            <Link to="/login" className="h-9 px-4 rounded-md text-[0.875rem] font-medium flex items-center justify-center bg-primary text-on-primary hover:bg-primary/90 transition-colors">
              Logistics Portal
            </Link>
          </div>
        </div>
      </header>

      <main className="w-full pt-16 bg-base">

        {/* ── Hero Section ── */}
        <section ref={heroRef} className="relative pt-24 pb-12 lg:pt-28 lg:pb-16 px-4 lg:px-8 border-b border-outline-variant/30 overflow-hidden">
          
          <HeroBackgroundMap scrollY={scrollY} />

          <motion.div 
            style={{ opacity: disableMotion ? 1 : heroOpacity, y: disableMotion ? 0 : heroY }}
            className="max-w-7xl mx-auto px-4 lg:px-8 relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center"
          >
            
            {/* Narrative Copy */}
            <div className="lg:col-span-6 flex flex-col items-start">
              <motion.h1 
                initial={{ opacity: 0, y: 8 }} 
                animate={{ opacity: 1, y: 0 }} 
                transition={{ duration: 0.5, ease: "easeOut", delay: disableMotion ? 0 : 0 }}
                className="text-[2.5rem] md:text-[3.5rem] font-semibold text-on-surface leading-[1.1] tracking-tight mb-4"
              >
                Move surplus food where it is <span className="text-primary">NEEDED</span>.
              </motion.h1>
              
              <motion.div 
                initial={{ opacity: 0, y: 8 }} 
                animate={{ opacity: 1, y: 0 }} 
                transition={{ duration: 0.5, ease: "easeOut", delay: disableMotion ? 0 : 0.1 }}
                className="flex items-center gap-2 text-[0.8125rem] font-mono-data text-on-surface-variant uppercase tracking-widest mb-6"
              >
                <span>Supply matched by:</span>
                <span className="text-primary font-bold">food type · quantity · distance · timing</span>
              </motion.div>
              
              <motion.p 
                initial={{ opacity: 0, y: 8 }} 
                animate={{ opacity: 1, y: 0 }} 
                transition={{ duration: 0.5, ease: "easeOut", delay: disableMotion ? 0 : 0.1 }}
                className="text-[1.125rem] text-on-surface-variant leading-relaxed mb-8 max-w-[42ch]"
              >
                RePlate connects commercial kitchens, food programs, drivers and municipal partners so surplus food can be matched, transported and documented before it becomes waste.
              </motion.p>
              
              <motion.div 
                initial={{ opacity: 0, y: 8 }} 
                animate={{ opacity: 1, y: 0 }} 
                transition={{ duration: 0.5, ease: "easeOut", delay: disableMotion ? 0 : 0.18 }}
                className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto"
              >
                <Link to="/login" className="h-11 px-6 rounded-md text-[0.9375rem] font-medium flex items-center justify-center bg-primary text-on-primary hover:bg-primary/90 transition-colors">
                  Logistics Portal
                </Link>
                <a href="#how-it-works" className="h-11 px-6 rounded-md text-[0.9375rem] font-medium flex items-center justify-center bg-surface-container border border-outline-variant text-on-surface hover:bg-surface-container-high transition-colors">
                  How it works
                </a>
              </motion.div>
            </div>

            {/* Visual Anchor: Network Diagram */}
            <motion.div 
              initial={{ opacity: 0, y: 8 }} 
              animate={{ opacity: 1, y: 0 }} 
              transition={{ duration: 0.5, ease: "easeOut", delay: disableMotion ? 0 : 0.25 }}
              className="lg:col-span-6 w-full flex justify-center lg:justify-end"
            >
               <div className="w-full max-w-md p-6 lg:p-8 bg-surface-container-lowest border border-outline-variant/50 rounded-md">
                 <div className="relative w-full mx-auto flex flex-col items-center font-mono-data text-[0.875rem]">
                   
                   {/* Background Track running top to bottom, strictly BEHIND cards */}
                   <div className="absolute top-4 bottom-4 left-1/2 w-px bg-outline-variant/30 -translate-x-1/2 z-0" />
                   
                   {/* The Single Continuous Marker */}
                   {!disableMotion && heroInView && (
                     <div className="absolute top-4 bottom-4 left-1/2 -translate-x-1/2 z-0 overflow-hidden w-1.5 pointer-events-none">
                        <motion.div 
                          className="w-full h-8 bg-primary rounded-full absolute"
                          animate={{ top: ["-20%", "110%"] }}
                          transition={{ duration: 1.8, ease: "linear", repeat: Infinity }}
                        />
                     </div>
                   )}

                   {/* Origin Card (z-10 solid bg masks the track) */}
                   <div className="w-full flex justify-between items-center p-3 border border-outline-variant rounded bg-surface relative z-10 mb-6 shadow-sm">
                     <div className="flex flex-col">
                       <span className="text-on-surface-variant uppercase tracking-widest text-[0.625rem] font-bold">Origin</span>
                       <span className="text-on-surface font-medium">Commercial Kitchens</span>
                     </div>
                     <span className="text-[0.75rem] text-on-surface-variant hidden sm:block">Surplus listed</span>
                   </div>
                   
                   <div className="text-outline-variant bg-surface px-2 py-1 rounded-full relative z-10 mb-6 border border-outline-variant/20 shadow-sm">
                     <ArrowDown size={16} />
                   </div>
                   
                   {/* Routing Card */}
                   <div className="w-full flex justify-between items-center p-3 border border-primary/30 rounded bg-surface relative z-10 mb-6 shadow-sm">
                     <div className="absolute inset-0 bg-primary/5 rounded pointer-events-none" />
                     <div className="flex flex-col relative z-20">
                       <span className="uppercase tracking-widest text-[0.625rem] font-bold text-primary">Routing</span>
                       <span className="font-medium text-primary">RePlate Matching Engine</span>
                     </div>
                     <span className="text-[0.75rem] text-primary relative z-20 hidden sm:block">Supply + demand</span>
                   </div>
                   
                   <div className="text-outline-variant bg-surface px-2 py-1 rounded-full relative z-10 mb-6 border border-outline-variant/20 shadow-sm">
                     <ArrowDown size={16} />
                   </div>
                   
                   {/* Destination Card */}
                   <div className="w-full flex justify-between items-center p-3 border border-outline-variant rounded bg-surface relative z-10 shadow-sm">
                     <div className="flex flex-col">
                       <span className="text-on-surface-variant uppercase tracking-widest text-[0.625rem] font-bold">Destination</span>
                       <span className="text-on-surface font-medium">NGO Food Programs</span>
                     </div>
                     <span className="text-[0.75rem] text-on-surface-variant hidden sm:block">Matched delivery</span>
                   </div>
                 </div>
               </div>
            </motion.div>

          </motion.div>
        </section>

        {/* ── Logistical Sequence ── */}
        <section id="how-it-works" className="w-full py-16 px-4 lg:px-8 border-b border-outline-variant/30">
          <div className="max-w-3xl mx-auto" ref={processRef}>
            <h2 className="text-[2rem] font-semibold text-on-surface mb-12 tracking-tight">From surplus to delivery</h2>
            
            <div className="relative">
              {/* Background structural track */}
              <div className="absolute left-[2.25rem] md:left-[3.75rem] top-3 bottom-0 w-px bg-outline-variant/30 z-0" />
              
              {/* Foreground progress track */}
              {!disableMotion && (
                <motion.div 
                  className="absolute left-[2.25rem] md:left-[3.75rem] top-3 bottom-0 w-px bg-primary z-0 origin-top" 
                  style={{ scaleY: processScroll }}
                />
              )}

              <ProcessStep 
                num="01" 
                title="Donor lists surplus" 
                desc="Donors log food type, quantity, preparation time, and availability window into the system. The record is created instantly." 
                progress={processScroll} start={0} mid={0.25} end={0.5}
                disableMotion={disableMotion}
              />
              <ProcessStep 
                num="02" 
                title="RePlate matches supply with demand" 
                desc="The system considers capacity, shelf life, transit time and route efficiency." 
                progress={processScroll} start={0.25} mid={0.5} end={0.75}
                disableMotion={disableMotion}
              />
              <ProcessStep 
                num="03" 
                title="Driver receives the dispatch" 
                desc="Pickup and drop-off windows are enforced and route information is provided." 
                progress={processScroll} start={0.5} mid={0.75} end={1.0}
                disableMotion={disableMotion}
              />
              <ProcessStep 
                num="04" 
                title="Delivery is recorded" 
                desc="The handoff creates a digital record of the completed delivery." 
                progress={processScroll} start={0.75} mid={0.875} end={1.0}
                disableMotion={disableMotion}
              />
            </div>
          </div>
        </section>

        {/* ── What Gets Matched Strip ── */}
        <section className="w-full py-8 px-4 lg:px-8 bg-surface-container-lowest border-b border-outline-variant/30 overflow-hidden">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
            <span className="text-[0.75rem] font-semibold uppercase tracking-widest text-on-surface-variant">Matching considers</span>
            <div className="flex flex-wrap items-center gap-3 sm:gap-6 text-[0.875rem] font-mono-data text-on-surface">
              {[
                "Food type", 
                "Quantity", 
                "Shelf life", 
                "Storage capacity", 
                "Distance", 
                "Delivery window"
              ].map((item, i, arr) => (
                <motion.div 
                  key={item}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.3, delay: disableMotion ? 0 : i * 0.05 }}
                  className="flex items-center gap-3 sm:gap-6"
                >
                  <span>{item}</span>
                  {i < arr.length - 1 && <span className="text-outline-variant">•</span>}
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Network Roles (State Machine Controlled) ── */}
        <section id="network-roles" ref={networkRef} className="w-full py-16 px-4 lg:px-8 border-b border-outline-variant/30 relative">
          <div className="max-w-7xl mx-auto relative z-10">
            <motion.h2 
              initial={{ opacity: 0 }}
              animate={networkState !== 'idle' ? { opacity: 1 } : { opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="text-[2rem] font-semibold text-on-surface mb-12 tracking-tight"
            >
              The network
            </motion.h2>
            
            <div className="relative w-full mt-8">
              
              {/* DESKTOP SVG Curved Path Layer */}
              <div className="hidden lg:block absolute top-[10px] left-0 w-full h-[150px] z-0 pointer-events-none">
                <svg viewBox="0 0 1200 150" className="w-full h-full overflow-visible" preserveAspectRatio="none">
                  
                  <defs>
                    <clipPath id="drawClip1">
                      <motion.rect x="150" y="-20" height="200" fill="white"
                         initial={{ width: 0 }}
                         animate={networkState !== 'idle' && networkState !== 'nodes_in' ? { width: 300 } : { width: 0 }}
                         transition={{ duration: 0.7, delay: 0 }}
                      />
                    </clipPath>
                    <clipPath id="drawClip2">
                      <motion.rect x="450" y="-20" height="200" fill="white"
                         initial={{ width: 0 }}
                         animate={networkState !== 'idle' && networkState !== 'nodes_in' ? { width: 300 } : { width: 0 }}
                         transition={{ duration: 0.7, delay: 0.6 }}
                      />
                    </clipPath>
                    <clipPath id="drawClip3">
                      <motion.rect x="750" y="-20" height="200" fill="white"
                         initial={{ width: 0 }}
                         animate={networkState !== 'idle' && networkState !== 'nodes_in' ? { width: 300 } : { width: 0 }}
                         transition={{ duration: 0.7, delay: 1.2 }}
                      />
                    </clipPath>
                  </defs>

                  {/* PATH 1: Donor -> NGO (Arches up) */}
                  <path 
                    d="M 150 75 C 250 0, 350 0, 450 75" 
                    fill="none" stroke="#2f6f52" strokeWidth="2" strokeDasharray="6 6" strokeLinecap="round" opacity={0.45}
                    clipPath="url(#drawClip1)"
                  />

                  {/* PATH 2: NGO -> Driver (Arches up) */}
                  <path 
                    d="M 450 75 C 550 0, 650 0, 750 75" 
                    fill="none" stroke="#2f6f52" strokeWidth="2" strokeDasharray="6 6" strokeLinecap="round" opacity={0.45}
                    clipPath="url(#drawClip2)"
                  />

                  {/* PATH 3: Driver -> Municipal (Arches up) */}
                  <path 
                    d="M 750 75 C 850 0, 950 0, 1050 75" 
                    fill="none" stroke="#2f6f52" strokeWidth="2" strokeDasharray="6 6" strokeLinecap="round" opacity={0.45}
                    clipPath="url(#drawClip3)"
                  />
                  
                  {/* Single Continuous Traveling Signal Dot */}
                  {networkState === 'loop' && (
                    <motion.path 
                      d="M 150 75 C 250 0, 350 0, 450 75 C 550 0, 650 0, 750 75 C 850 0, 950 0, 1050 75" 
                      fill="none" stroke="#0b5d3b" strokeWidth="6" strokeLinecap="round" 
                      initial={{ pathLength: 0.001, pathSpacing: 1 }}
                      style={{ pathOffset: networkPathOffset, opacity: dotOpacity }} 
                    />
                  )}
                </svg>
              </div>

              {/* Desktop Node Layout */}
              <div className="hidden lg:grid grid-cols-4 relative z-10 pt-[78px]">
                <div className="px-2 w-full">
                  <NetworkRoleNode 
                    title="Commercial food donors" 
                    desc="List available surplus and provide quantity, food type and pickup window." 
                    progress={signalProgress} activeRange={[0, 1/7]} 
                    state={networkState} disableMotion={disableMotion} 
                  />
                </div>
                <div className="px-2 w-full">
                  <NetworkRoleNode 
                    title="NGO meal programs" 
                    desc="Define capacity, dietary requirements and delivery needs." 
                    progress={signalProgress} activeRange={[2/7, 3/7]} 
                    state={networkState} disableMotion={disableMotion} 
                  />
                </div>
                <div className="px-2 w-full">
                  <NetworkRoleNode 
                    title="Transport drivers" 
                    desc="Receive dispatch instructions and complete timed pickups and drop-offs." 
                    progress={signalProgress} activeRange={[4/7, 5/7]} 
                    state={networkState} disableMotion={disableMotion} 
                  />
                </div>
                <div className="px-2 w-full">
                  <NetworkRoleNode 
                    title="Municipal hubs" 
                    desc="Provide oversight and reporting across local food recovery activity." 
                    progress={signalProgress} activeRange={[6/7, 1.0]} 
                    state={networkState} disableMotion={disableMotion} 
                  />
                </div>
              </div>

              {/* Mobile/Tablet Fallback Layout (Vertical Sequence) */}
              <div className="lg:hidden flex flex-col gap-10 relative pl-10 z-10">
                {/* Dynamic Vertical Path Drawing */}
                <div className="absolute left-[0.6rem] top-6 bottom-6 w-0.5 z-0 flex flex-col justify-between overflow-hidden">
                  <motion.div 
                    className="w-full h-full border-l-[2px] border-dashed border-[#2f6f52] opacity-45 origin-top"
                    initial={{ height: "0%" }}
                    animate={networkState === 'paths_drawing' || networkState === 'loop' ? { height: "100%" } : { height: "0%" }}
                    transition={{ duration: 2, ease: "easeInOut" }}
                  />
                </div>
                
                {/* Moving signal dot locked to vertical track */}
                {networkState === 'loop' && (
                  <div className="absolute left-[0.45rem] top-6 bottom-6 z-10 pointer-events-none">
                     <motion.div 
                        className="w-2 h-2 bg-[#0b5d3b] rounded-full absolute"
                        style={{ top: mobileSignalTop, opacity: dotOpacity }}
                     />
                  </div>
                )}
                
                <NetworkRoleNodeMobile title="Commercial food donors" desc="List available surplus and provide quantity, food type and pickup window." progress={signalProgress} activeRange={[0, 1/7]} state={networkState} disableMotion={disableMotion} />
                <NetworkRoleNodeMobile title="NGO meal programs" desc="Define capacity, dietary requirements and delivery needs." progress={signalProgress} activeRange={[2/7, 3/7]} state={networkState} disableMotion={disableMotion} />
                <NetworkRoleNodeMobile title="Transport drivers" desc="Receive dispatch instructions and complete timed pickups and drop-offs." progress={signalProgress} activeRange={[4/7, 5/7]} state={networkState} disableMotion={disableMotion} />
                <NetworkRoleNodeMobile title="Municipal hubs" desc="Provide oversight and reporting across local food recovery activity." progress={signalProgress} activeRange={[6/7, 1.0]} state={networkState} disableMotion={disableMotion} />
              </div>
              
            </div>
          </div>
        </section>

        {/* ── Traceability ── */}
        <section id="traceability" ref={traceRef} className="w-full py-16 px-4 lg:px-8 bg-surface-container-lowest border-b border-outline-variant/30 overflow-hidden">
          <div className="max-w-5xl mx-auto text-center">
            <motion.h2 
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="text-[2.25rem] font-semibold text-on-surface mb-4 tracking-tight"
            >
              Every handoff is recorded
            </motion.h2>
            <motion.p 
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="text-[1rem] text-on-surface-variant leading-relaxed mb-12 max-w-[60ch] mx-auto"
            >
              RePlate is designed to support municipal reporting requirements. The system logs timestamps, locations, and digital signatures at every step, creating a clear chain of custody. Each stage records the relevant event, including timestamp, location and handoff status.
            </motion.p>
            
            {/* Traceability Flow */}
            <div className="relative max-w-4xl mx-auto py-2">
               {/* Desktop Horizontal Track (z-0) */}
               <div className="hidden sm:block absolute top-1/2 left-8 right-8 h-px bg-outline-variant/30 -translate-y-1/2 z-0" />
               {!disableMotion && (
                 <motion.div 
                   className="hidden sm:block absolute top-1/2 left-8 h-px bg-primary -translate-y-1/2 z-0 origin-left"
                   style={{ width: traceProgressWidth, maxWidth: 'calc(100% - 4rem)' }}
                 />
               )}

               {/* Mobile Vertical Track (z-0) */}
               <div className="sm:hidden absolute top-8 bottom-8 left-1/2 w-px bg-outline-variant/30 -translate-x-1/2 z-0" />
               {!disableMotion && (
                 <motion.div 
                   className="sm:hidden absolute top-8 left-1/2 w-px bg-primary -translate-x-1/2 z-0 origin-top"
                   style={{ height: traceProgressHeight, maxHeight: 'calc(100% - 4rem)' }}
                 />
               )}
               
               {/* Nodes (z-10 on solid backgrounds to mask lines) */}
               <div className="flex flex-col sm:flex-row items-center justify-between gap-6 sm:gap-4 relative z-10 font-mono-data text-[0.875rem]">
                 <TraceStage name="Donation" progress={traceScroll} threshold={0.2} disableMotion={disableMotion} />
                 
                 <TraceStage name="Matching" progress={traceScroll} threshold={0.4} disableMotion={disableMotion} />
                 
                 <TraceStage name="Dispatch" progress={traceScroll} threshold={0.6} disableMotion={disableMotion} />
                 
                 <TraceStage name="Delivery" progress={traceScroll} threshold={0.8} disableMotion={disableMotion} />
                 
                 <TraceStage name="Record" progress={traceScroll} threshold={1.0} disableMotion={disableMotion} />
               </div>
            </div>
          </div>
        </section>

        {/* ── Operational Facts ── */}
        <section className="w-full py-16 px-4 lg:px-8 border-b border-outline-variant/30">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-[1.5rem] font-semibold text-on-surface mb-12 tracking-tight">Built around the realities of perishable food.</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
              <FactCard 
                title="Short Windows" 
                desc="Food availability and pickup times matter." 
                delay={0} disableMotion={disableMotion} 
              />
              <FactCard 
                title="Local Matching" 
                desc="Recipients are matched based on capacity and location." 
                delay={0.1} disableMotion={disableMotion} 
              />
              <FactCard 
                title="Documented Handoffs" 
                desc="Each completed transfer creates a delivery record." 
                delay={0.2} disableMotion={disableMotion} 
              />
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="w-full py-20 lg:py-28 px-4 lg:px-8 overflow-hidden">
          <div className="max-w-4xl mx-auto text-center">
            <motion.h2 
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
              className="text-[2.25rem] font-semibold text-on-surface mb-4 tracking-tight"
            >
              Ready to put surplus food back into circulation?
            </motion.h2>
            <motion.p 
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: disableMotion ? 0 : 0.1 }}
              className="text-[1rem] text-on-surface-variant mb-12"
            >
              Join the network as a food donor or recipient.
            </motion.p>
            
            <motion.div 
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: disableMotion ? 0 : 0.2 }}
              className="flex flex-col sm:flex-row justify-center items-center gap-6"
            >
              <div className="flex flex-col items-center w-full sm:w-auto">
                <span className="text-[0.9375rem] font-medium text-on-surface mb-3">Commercial kitchens</span>
                <Link to="/login" className="h-11 px-6 rounded-md text-[0.9375rem] font-medium flex items-center justify-center bg-primary text-on-primary hover:bg-primary/90 transition-colors w-full sm:w-auto">
                  Register a kitchen
                </Link>
              </div>
              <div className="hidden sm:block w-[1px] h-16 bg-outline-variant/50 mx-2"></div>
              <div className="flex flex-col items-center w-full sm:w-auto">
                <span className="text-[0.9375rem] font-medium text-on-surface mb-3">Food programs</span>
                <Link to="/login" className="h-11 px-6 rounded-md text-[0.9375rem] font-medium flex items-center justify-center bg-surface-container border border-outline-variant text-on-surface hover:bg-surface-container-high transition-colors w-full sm:w-auto">
                  Apply as a recipient
                </Link>
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="w-full py-12 px-4 lg:px-8 bg-surface-container-lowest border-t border-outline-variant/30">
        <motion.div 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="max-w-7xl mx-auto"
        >
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
            <div className="md:col-span-1 flex flex-col items-start">
              <div className="flex items-center gap-3 mb-4">
                <Leaf size={20} className="text-primary" />
                <span className="font-bold text-[1rem] text-on-surface tracking-tight">RePlate</span>
              </div>
              <p className="text-[0.875rem] text-on-surface-variant leading-relaxed">
                Connecting surplus food with organizations that can use it.
              </p>
            </div>
            
            <div>
              <span className="text-[0.8125rem] font-semibold text-on-surface uppercase tracking-widest block mb-4">Platform</span>
              <ul className="flex flex-col gap-3">
                <li><a href="#how-it-works" className="text-[0.875rem] text-on-surface-variant hover:text-primary transition-colors">How it works</a></li>
                <li><a href="#network-roles" className="text-[0.875rem] text-on-surface-variant hover:text-primary transition-colors">Network roles</a></li>
                <li><a href="#traceability" className="text-[0.875rem] text-on-surface-variant hover:text-primary transition-colors">Traceability</a></li>
              </ul>
            </div>
            
            <div>
              <span className="text-[0.8125rem] font-semibold text-on-surface uppercase tracking-widest block mb-4">Participate</span>
              <ul className="flex flex-col gap-3">
                <li><Link to="/login" className="text-[0.875rem] text-on-surface-variant hover:text-primary transition-colors">Register a kitchen</Link></li>
                <li><Link to="/login" className="text-[0.875rem] text-on-surface-variant hover:text-primary transition-colors">Join as a recipient</Link></li>
              </ul>
            </div>
            
            <div>
              <span className="text-[0.8125rem] font-semibold text-on-surface uppercase tracking-widest block mb-4">Legal</span>
              <ul className="flex flex-col gap-3">
                <li><a href="#" className="text-[0.875rem] text-on-surface-variant hover:text-primary transition-colors">Privacy policy</a></li>
                <li><a href="#" className="text-[0.875rem] text-on-surface-variant hover:text-primary transition-colors">Terms of service</a></li>
              </ul>
            </div>
          </div>
          
          <div className="flex flex-col md:flex-row justify-between items-center pt-8 border-t border-outline-variant/30 text-[0.8125rem] text-on-surface-variant">
            <span>© 2025 RePlate. All rights reserved.</span>
          </div>
        </motion.div>
      </footer>
    </div>
  );
}

// ── Helper Components ──

function ProcessStep({ num, title, desc, progress, start, mid, end, disableMotion }: 
  { num: string, title: string, desc: string, progress: MotionValue<number>, start: number, mid: number, end: number, disableMotion: boolean }) 
{
  const textColor = useTransform(progress, 
    [start, mid, end], 
    ["var(--on-surface-variant)", "var(--on-surface)", "var(--on-surface)"]
  );
  
  const numColor = useTransform(progress,
    [start, mid, end],
    ["var(--outline-variant)", "var(--primary)", "var(--primary)"]
  );

  const dotBgColor = useTransform(progress,
    [start, mid, end],
    ["var(--surface)", "var(--primary)", "rgba(var(--primary), 0.2)"]
  );

  const dotBorderColor = useTransform(progress,
    [start, mid, end],
    ["var(--outline-variant)", "var(--primary)", "var(--primary)"]
  );

  if (disableMotion) {
    return (
      <div className="flex gap-4 md:gap-10 relative z-10 pb-10">
        <div className="w-5 md:w-10 shrink-0 text-right font-mono-data pt-1 text-primary">
          <span>{num}</span>
        </div>
        <div className="flex flex-col items-center pt-[10px]">
          <div className="w-2.5 h-2.5 rounded-full border border-primary bg-primary" />
        </div>
        <div className="flex-1 pt-0">
          <h3 className="text-[1.125rem] font-medium mb-1.5 text-on-surface">
            {title}
          </h3>
          <p className="text-[0.9375rem] leading-relaxed max-w-[60ch] opacity-80 text-on-surface-variant">
            {desc}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-4 md:gap-10 relative z-10 pb-10 last:pb-0">
      <div className="w-5 md:w-10 shrink-0 text-right font-mono-data pt-1">
        <motion.span style={{ color: numColor }} className="transition-colors duration-300">
          {num}
        </motion.span>
      </div>
      <div className="flex flex-col items-center pt-[10px]">
        <motion.div 
          style={{ backgroundColor: dotBgColor, borderColor: dotBorderColor }} 
          className="w-2.5 h-2.5 rounded-full border transition-colors duration-300 z-10 bg-base" 
        />
      </div>
      <div className="flex-1 pt-0">
        <motion.h3 style={{ color: textColor }} className="text-[1.125rem] font-medium mb-1.5 transition-colors duration-300">
          {title}
        </motion.h3>
        <motion.p style={{ color: textColor }} className="text-[0.9375rem] leading-relaxed max-w-[60ch] opacity-80 transition-colors duration-300">
          {desc}
        </motion.p>
      </div>
    </div>
  );
}

function NetworkRoleNode({ title, desc, progress, activeRange, state, disableMotion }: 
  { title: string, desc: string, progress: MotionValue<number>, activeRange: [number, number], state: string, disableMotion: boolean }) 
{
  const [start, end] = activeRange;
  const safePre = start - 0.05;
  const safePost = end + 0.05;

  // States: Upcoming -> Active -> Completed
  const textColor = useTransform(progress, 
    [safePre, start, end, safePost], 
    ["var(--on-surface-variant)", "var(--on-surface)", "var(--on-surface)", "var(--on-surface-variant)"]
  );
  
  const iconColor = useTransform(progress,
    [safePre, start, end, safePost],
    ["transparent", "#0b5d3b", "#0b5d3b", "transparent"]
  );

  const iconBorderColor = useTransform(progress,
    [safePre, start, end, safePost],
    ["#2f6f52", "#0b5d3b", "#0b5d3b", "rgba(11, 93, 59, 0.45)"]
  );

  const scale = useTransform(progress,
    [safePre, start, end, safePost],
    [1, 1.05, 1.05, 1]
  );

  if (disableMotion) {
    return (
      <div className="flex flex-col items-center text-center relative z-10">
        <div className="w-3.5 h-3.5 rounded-full mb-6 border-[2px] bg-[#0b5d3b] border-[#0b5d3b]" />
        <h3 className="text-[1.125rem] font-semibold text-on-surface mb-3">{title}</h3>
        <p className="text-[0.9375rem] text-on-surface-variant leading-relaxed max-w-[24ch]">
          {desc}
        </p>
      </div>
    );
  }

  const isVisible = state !== 'idle';

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={isVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
      transition={{ duration: 0.5 }}
      style={state === 'loop' ? { scale } : {}} 
      className="flex flex-col items-center text-center relative z-10 origin-top"
    >
      <motion.div 
        style={state === 'loop' ? { backgroundColor: iconColor, borderColor: iconBorderColor } : { borderColor: "#2f6f52", backgroundColor: "transparent" }} 
        className="w-3.5 h-3.5 rounded-full mb-6 border-[2px] bg-base" 
      />
      <motion.h3 style={state === 'loop' ? { color: textColor } : { color: "var(--on-surface-variant)" }} className="text-[1.125rem] font-semibold mb-3">
        {title}
      </motion.h3>
      <motion.p style={state === 'loop' ? { color: textColor } : { color: "var(--on-surface-variant)" }} className="text-[0.9375rem] leading-relaxed max-w-[24ch]">
        {desc}
      </motion.p>
    </motion.div>
  );
}

function NetworkRoleNodeMobile({ title, desc, progress, activeRange, state, disableMotion }: 
  { title: string, desc: string, progress: MotionValue<number>, activeRange: [number, number], state: string, disableMotion: boolean }) 
{
  const [start, end] = activeRange;
  const safePre = start - 0.05;
  const safePost = end + 0.05;

  const textColor = useTransform(progress, 
    [safePre, start, end, safePost], 
    ["var(--on-surface-variant)", "var(--on-surface)", "var(--on-surface)", "var(--on-surface-variant)"]
  );
  
  const iconColor = useTransform(progress,
    [safePre, start, end, safePost],
    ["transparent", "#0b5d3b", "#0b5d3b", "transparent"]
  );

  const iconBorderColor = useTransform(progress,
    [safePre, start, end, safePost],
    ["#2f6f52", "#0b5d3b", "#0b5d3b", "rgba(11, 93, 59, 0.45)"]
  );

  if (disableMotion) {
    return (
      <div className="flex items-start gap-6 relative z-10">
        <div className="w-3.5 h-3.5 rounded-full mt-2 shrink-0 border-[2px] bg-[#0b5d3b] border-[#0b5d3b]" />
        <div>
          <h3 className="text-[1.125rem] font-semibold text-on-surface mb-2">{title}</h3>
          <p className="text-[0.9375rem] text-on-surface-variant leading-relaxed">
            {desc}
          </p>
        </div>
      </div>
    );
  }

  const isVisible = state !== 'idle';

  return (
    <motion.div 
      initial={{ opacity: 0, x: -10 }}
      animate={isVisible ? { opacity: 1, x: 0 } : { opacity: 0, x: -10 }}
      transition={{ duration: 0.4 }}
      className="flex items-start gap-6 relative z-10"
    >
      <motion.div 
        style={state === 'loop' ? { backgroundColor: iconColor, borderColor: iconBorderColor } : { borderColor: "#2f6f52", backgroundColor: "transparent" }} 
        className="w-3 h-3 rounded-full mt-2 shrink-0 border-[2px] bg-base" 
      />
      <div>
        <motion.h3 style={state === 'loop' ? { color: textColor } : { color: "var(--on-surface-variant)" }} className="text-[1.125rem] font-semibold mb-2 transition-colors duration-150">
          {title}
        </motion.h3>
        <motion.p style={state === 'loop' ? { color: textColor } : { color: "var(--on-surface-variant)" }} className="text-[0.9375rem] leading-relaxed transition-colors duration-150">
          {desc}
        </motion.p>
      </div>
    </motion.div>
  );
}


function TraceStage({ name, progress, threshold, disableMotion }: { name: string, progress: MotionValue<number>, threshold: number, disableMotion: boolean }) {
  const bgColor = useTransform(progress, 
    [threshold - 0.2, threshold], 
    ["var(--surface-container-lowest)", "rgba(var(--primary), 0.1)"]
  );
  
  const borderColor = useTransform(progress, 
    [threshold - 0.2, threshold], 
    ["var(--outline-variant)", "var(--primary)"]
  );
  
  const textColor = useTransform(progress, 
    [threshold - 0.2, threshold], 
    ["var(--on-surface-variant)", "var(--primary)"]
  );

  if (disableMotion) {
    return (
      <span className="py-2 px-4 border rounded font-bold shadow-sm border-outline-variant bg-surface-container-lowest text-on-surface-variant">
        {name}
      </span>
    );
  }

  return (
    <motion.div 
      style={{ backgroundColor: bgColor, borderColor: borderColor, color: textColor }}
      className="py-2 px-4 border rounded font-bold shadow-sm transition-colors duration-200 relative z-10"
    >
      <div className="absolute inset-0 bg-surface-container-lowest -z-10 rounded" />
      {name}
    </motion.div>
  );
}

function FactCard({ title, desc, delay, disableMotion }: { title: string, desc: string, delay: number, disableMotion: boolean }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.4, delay: disableMotion ? 0 : delay }}
    >
      <h3 className="text-[0.75rem] font-bold uppercase tracking-widest text-on-surface-variant mb-2">{title}</h3>
      <p className="text-[0.9375rem] text-on-surface leading-relaxed">{desc}</p>
    </motion.div>
  );
}

function HeroBackgroundMap({ scrollY }: { scrollY: MotionValue<number> }) {
  const mapY = useTransform(scrollY, [0, 800], [0, 15]);

  return (
    <motion.div 
      className="absolute inset-0 z-0 pointer-events-none overflow-hidden"
      style={{ y: mapY }}
    >
      <div 
        className="absolute inset-0 w-full h-full" 
        style={{ 
          // Reduces opacity by ~50% specifically behind the left-aligned hero text, 100% visible elsewhere
          maskImage: 'radial-gradient(ellipse 60% 60% at 30% 40%, rgba(0,0,0,0.5) 0%, rgba(0,0,0,1) 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 60% 60% at 30% 40%, rgba(0,0,0,0.5) 0%, rgba(0,0,0,1) 100%)' 
        }}
      >
        <svg viewBox="0 0 1440 800" className="w-full h-full" preserveAspectRatio="xMidYMid slice">
          
          {/* LAYER 1: Geographic Grid (Opacity: 0.08) */}
          <g opacity="0.08" className="hidden md:inline">
            <line x1="200" y1="-200" x2="200" y2="1000" stroke="#2f6f52" strokeWidth="1" strokeDasharray="3 6" />
            <line x1="650" y1="-200" x2="650" y2="1000" stroke="#2f6f52" strokeWidth="0.5" />
            <line x1="1100" y1="-200" x2="1100" y2="1000" stroke="#2f6f52" strokeWidth="1" strokeDasharray="4 8" />
            
            <line x1="-200" y1="150" x2="1800" y2="150" stroke="#2f6f52" strokeWidth="1" strokeDasharray="3 6" />
            <line x1="-200" y1="450" x2="1800" y2="450" stroke="#2f6f52" strokeWidth="0.5" />
            <line x1="-200" y1="700" x2="1800" y2="700" stroke="#2f6f52" strokeWidth="1" strokeDasharray="4 8" />
            
            {/* Coordinate Crosshairs */}
            <path d="M 400 340 L 400 360 M 390 350 L 410 350" stroke="#2f6f52" strokeWidth="1.5" />
            <path d="M 900 640 L 900 660 M 890 650 L 910 650" stroke="#2f6f52" strokeWidth="1.5" />
            <path d="M 250 500 L 250 520 M 240 510 L 260 510" stroke="#2f6f52" strokeWidth="1" />
          </g>

          {/* LAYER 2: Geographic Boundaries (Opacity: 0.12) */}
          <g opacity="0.12" fill="none" stroke="#2f6f52" strokeWidth="1.5" strokeDasharray="4 4" className="hidden md:inline">
            <path d="M -150 400 L 150 350 L 250 450 L 50 550 Z" />
            <path d="M 1200 -50 L 1400 -100 L 1550 150 L 1300 300 Z" />
            <path d="M 500 850 L 700 700 L 850 750 L 650 950 Z" />
          </g>

          {/* LAYER 3: Secondary Routes (Opacity: 0.16) */}
          <g opacity="0.16" fill="none" stroke="#2f6f52" strokeWidth="1.5">
            {/* Route 3: Off-screen left -> D -> G -> Off-screen right */}
            <path d="M -150 200 C 150 250, 300 300, 500 350 C 700 400, 700 450, 800 500 C 1000 600, 1300 600, 1600 600" />
            
            {/* Route 4: Off-screen left -> E -> Off-screen bottom */}
            <path d="M -150 500 C 100 550, 250 600, 400 600 C 550 600, 650 750, 750 950" className="hidden lg:inline" />
            
            {/* Dashed secondary connectors (Node to Node) */}
            <path d="M 500 350 C 600 350, 600 250, 700 150" strokeDasharray="6 6" className="hidden lg:inline" />
            <path d="M 800 500 C 900 500, 950 450, 1050 450" strokeDasharray="6 6" />
          </g>

          {/* LAYER 4: Primary Logistics Routes (Opacity: 0.25) */}
          <g opacity="0.25" fill="none" stroke="#0b5d3b" strokeWidth="2.5">
            {/* Route 1: Off-screen bottom-left -> A -> B -> C -> Off-screen right */}
            <path d="M -100 850 C 0 700, 50 600, 150 550 C 450 400, 600 650, 850 350 C 950 250, 1000 350, 1050 350 C 1250 350, 1450 350, 1650 350" />
            
            {/* Route 2: Off-screen top -> F -> C -> H -> Off-screen bottom */}
            <path d="M 300 -150 C 450 0, 550 50, 700 150 C 900 250, 1050 250, 1050 350 L 1050 450 C 1050 650, 1200 800, 1400 950" />
          </g>

          {/* LAYER 5: Network Nodes (Opacity: 0.35) */}
          <g opacity="0.35">
            {/* Standard nodes exactly on intersecting paths */}
            {/* A */} <circle cx="150" cy="550" r="5" fill="#fdfdfb" stroke="#0b5d3b" strokeWidth="2" />
            {/* B */} <circle cx="850" cy="350" r="6" fill="#fdfdfb" stroke="#0b5d3b" strokeWidth="2" />
            {/* D */} <circle cx="500" cy="350" r="4.5" fill="#fdfdfb" stroke="#0b5d3b" strokeWidth="2" className="hidden lg:inline" />
            {/* E */} <circle cx="400" cy="600" r="4" fill="#fdfdfb" stroke="#0b5d3b" strokeWidth="2" />
            {/* F */} <circle cx="700" cy="150" r="4.5" fill="#fdfdfb" stroke="#0b5d3b" strokeWidth="2" />
            {/* G */} <circle cx="800" cy="500" r="5" fill="#fdfdfb" stroke="#0b5d3b" strokeWidth="2" />
            
            {/* C (Active Matching Engine Node) */}
            <circle cx="1050" cy="350" r="7" fill="#0b5d3b" />
            <circle cx="1050" cy="350" r="14" fill="none" stroke="#0b5d3b" strokeWidth="1.5" opacity="0.6" />
            
            {/* H (Terminal Node) */}
            <circle cx="1050" cy="450" r="5" fill="#fdfdfb" stroke="#0b5d3b" strokeWidth="2" />
          </g>

          {/* LAYER 6: Animated Signals (Opacity: 0.8) */}
          <g opacity="0.8">
            <motion.path 
              d="M -100 850 C 0 700, 50 600, 150 550 C 450 400, 600 650, 850 350 C 950 250, 1000 350, 1050 350 C 1250 350, 1450 350, 1650 350"
              fill="none" stroke="#0b5d3b" strokeWidth="6" strokeLinecap="round"
              initial={{ pathLength: 0.001, pathSpacing: 1 }}
              animate={{ pathOffset: [0, 1] }}
              transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
            />
            <motion.path 
              d="M 300 -150 C 450 0, 550 50, 700 150 C 900 250, 1050 250, 1050 350 L 1050 450 C 1050 650, 1200 800, 1400 950"
              fill="none" stroke="#0b5d3b" strokeWidth="5" strokeLinecap="round"
              initial={{ pathLength: 0.001, pathSpacing: 1 }}
              animate={{ pathOffset: [0, 1] }}
              transition={{ duration: 15, repeat: Infinity, ease: "linear", delay: 5 }}
              opacity="0.75"
            />
          </g>

        </svg>
      </div>
    </motion.div>
  );
}
