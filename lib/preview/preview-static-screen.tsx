import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type PreviewStaticScreenProps = {
  title: string;
  description: string;
  items: Array<{ title: string; detail: string }>;
};

export function PreviewStaticScreen({ title, description, items }: PreviewStaticScreenProps) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-5 overflow-y-auto p-4 lg:p-6">
      <section className="rounded-[32px] border border-white/5 bg-[#0a0a0a] p-6">
        <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
          Exemplo ilustrativo
        </Badge>
        <h1 className="mt-4 text-[24px] font-medium tracking-wide text-white sm:text-[32px]">{title}</h1>
        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-white/50">{description}</p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <div key={item.title} className="rounded-[24px] border border-white/5 bg-[#0c0c0c] p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-full border border-primary/20 bg-primary/10 p-2.5 text-primary">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[14px] font-semibold text-white">{item.title}</p>
                <p className="mt-1.5 text-[12px] leading-relaxed text-white/40">{item.detail}</p>
              </div>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
