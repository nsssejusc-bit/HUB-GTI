import { useNavigate } from "react-router-dom";
import { Code2 } from "lucide-react";

export default function Footer() {
  const navigate = useNavigate();

  return (
    <footer className="border-t border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 py-2 text-center">
      <button
        onClick={() => navigate("/equipe")}
        className="inline-flex items-center gap-1.5 text-xs text-slate-400 dark:text-gray-500 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
      >
        <Code2 size={13} />
        Desenvolvido pela Gerência de Tecnologia da Informação - GTI · SEJUSC
      </button>
    </footer>
  );
}
