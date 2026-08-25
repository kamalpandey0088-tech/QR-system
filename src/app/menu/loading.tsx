export default function MenuLoading() {
  return (
    <div className="min-h-screen bg-[#060B14] flex flex-col items-center justify-center p-6">
      {/* Animated Logo / Spinner */}
      <div className="relative w-24 h-24 mb-8">
        <div className="absolute inset-0 border-4 border-white/10 rounded-full"></div>
        <div className="absolute inset-0 border-4 border-t-white border-r-white/50 border-b-transparent border-l-transparent rounded-full animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-3xl">🍽️</span>
        </div>
      </div>
      
      <h1 className="text-2xl font-black text-white tracking-widest uppercase mb-2 animate-pulse">
        Loading Menu
      </h1>
      <p className="text-gray-400 text-sm font-medium animate-pulse">
        Fetching fresh items from the kitchen...
      </p>

      {/* Skeleton Grid */}
      <div className="w-full max-w-md mt-12 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="w-full h-32 bg-white/5 rounded-3xl animate-pulse"></div>
        ))}
      </div>
    </div>
  );
}
