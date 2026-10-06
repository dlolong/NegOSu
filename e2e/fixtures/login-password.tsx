import { createRoot } from "react-dom/client";
import { useState } from "react";
import { LoginPasswordField } from "@/components/login-password-field";
function Fixture() {
  const [submissions, setSubmissions] = useState(0);
  return <form onSubmit={event => { event.preventDefault(); setSubmissions(count => count + 1); }}><LoginPasswordField/><output id="login-submissions">{submissions}</output></form>;
}
createRoot(document.getElementById("root")!).render(<Fixture/>);
