import {createRoot} from 'react-dom/client';
import {SettlementFields} from '@/components/hospitality/settlement-fields';
import {Button} from '@/components/ui/button';
const wait = () => new Promise<void>(resolve=>setTimeout(resolve,700));
createRoot(document.getElementById('root')!).render(<>
 <form action={wait} className="grid grid-cols-1 gap-4 sm:grid-cols-2"><SettlementFields base={100000} currency="PHP" prefix="test" closeHref="/back" depositEnabled/></form>
 <form action={wait}><Button id="plain-submit" type="submit">Save record</Button></form>
 <Button id="async-action" onClick={wait}>Perform action</Button>
</>);
