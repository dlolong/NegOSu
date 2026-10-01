export type GuideStep = {element:string;title:string;description:string};
export type PageGuide = {id:string;title:string;steps:GuideStep[]};
export function pageGuide(path:string,industry?:string):PageGuide|null {
 if(path==="/dashboard"||path==="/dashboard/pet-care")return {id:"dashboard",title:"Dashboard guide",steps:[
  {element:"#dashboard-primary-actions, #pet-dashboard-walk-in-button, #negosu-staff-dashboard-walk-in",title:"Start your daily work",description:industry === "hospitality" ? "Choose Check in guest to select an available room and start a stay." : "Use Add walk-in for arriving clients or Book appointment for a future visit."},
  {element:"#negosu-command-center-metrics, #pet-care-finance",title:"Review your branch",description:"See activity and balances for the current view. Switch branch before starting work for another location."},
  {element:"#negosu-today-operations, #pet-care-today, #negosu-staff-dashboard-today",title:"Follow today's work",description:"Open a visit or stay to see its details and available next actions."},
  {element:"#dashboard-discover-new-sale",title:"Sell products",description:"Start a product-only sale. Customer details are optional for walk-in purchases."},
  {element:"#dashboard-public-website",title:"Share your public website",description:"Check publication status and find your website address. Published websites let clients explore your services and request bookings."},
 ]};
 if(path==="/dashboard/checkout/new")return {id:"new-sale",title:"New sale guide",steps:[
  {element:"#checkout-customer-select",title:"Customer is optional",description:"Choose an existing customer for a named receipt, or leave this blank for a walk-in purchase. No phone number is required."},
  {element:"#product-new-sale-button",title:"Choose products next",description:"Continue to checkout to find products, set quantities and review the order before payment."},
 ]};
 if(/^\/dashboard\/checkout\/[^/]+\/payment$/.test(path))return {id:"payment",title:"Payment guide",steps:[
  {element:"#payment-order-summary",title:"Review the amount due",description:"Check the order and remaining balance before recording a payment."},
  {element:"#payment-amount-input",title:"Enter the amount received",description:"Enter the actual amount collected. Partial payments leave a remaining balance."},
  {element:"#payment-method-select",title:"Choose the payment method",description:"Select how the customer paid and add a reference when relevant."},
  {element:"#payment-submit-button",title:"Record payment",description:"Submit only after receiving payment. A receipt is available afterward; product handover and completing a visit remain separate actions."},
 ]};
 if(/^\/dashboard\/checkout\/[^/]+$/.test(path))return {id:"checkout",title:"Checkout guide",steps:[
  {element:"#checkout-order-lines",title:"Review the order",description:"Review existing services, promo inclusions and products before collecting payment."},
  {element:"#checkout-add-product-button",title:"Add products",description:"Search the catalog and choose quantities. Accepted stock is reserved until handover."},
  {element:"#checkout-products-section",title:"Record product handover",description:"Use Handover when products are given to the customer. Payment alone does not deduct physical stock."},
  {element:"#checkout-summary",title:"Check totals",description:"Review the total, recorded payments and remaining balance. Included promo products should not be charged again."},
  {element:"#checkout-proceed-payment-button",title:"Continue to payment",description:"Review and finalize the order, then record the amount collected. You can print a receipt afterward."},
 ]};
 return null;
}
export function guideStorageKey(membership:string,industry:string,role:string,guide:string){
 return `negosu:guide:v1:${membership}:${industry}:${role}:${guide}`;
}
