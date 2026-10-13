import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

export default function AiPayment() {
  const { billId } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    navigate(`/movies?billId=${billId}`, { replace: true });
  }, [billId, navigate]);

  return (
    <div className="min-h-screen pt-24 flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
    </div>
  );
}
