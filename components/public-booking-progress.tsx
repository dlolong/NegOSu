export function PublicBookingProgress({step}:{step:number}){
 const labels=["Services or promo","Date","Time","Your details","Review"];
 return <nav id="public-booking-progress" aria-label="Booking progress" className="mb-5"><p className="mb-2 text-sm font-medium" aria-live="polite">Step {step} of 5 · {labels[step-1]}</p><ol className="flex gap-1.5">{labels.map((label,index)=><li key={label} aria-current={index+1===step?"step":undefined} aria-label={`${index+1}. ${label}${index+1<step?", completed":""}`} className={`h-1.5 flex-1 rounded-full ${index+1<=step?"bg-brand-primary":"bg-admin-border"}`}/>)}</ol></nav>;
}
