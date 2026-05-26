/**
 * PriorityBadge — Phase 4
 * Colored priority badge: red=urgent, orange=high, blue=normal.
 */
export default function PriorityBadge({ priority, style = {} }) {
    const getBadgeStyle = () => {
        switch (priority) {
            case "urgent":
                return { background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA" };
            case "high":
                return { background: "#FFF7ED", color: "#EA580C", border: "1px solid #FFEDD5" };
            case "normal":
            default:
                return { background: "#EFF6FF", color: "#2563EB", border: "1px solid #BFDBFE" };
        }
    };

    return (
        <span
            style={{
                display: "inline-block",
                padding: "0.25rem 0.6rem",
                borderRadius: "9999px",
                fontSize: "0.75rem",
                fontWeight: "600",
                textTransform: "capitalize",
                ...getBadgeStyle(),
                ...style,
            }}
        >
            {priority === "urgent" ? "🚨 " : priority === "high" ? "⚠️ " : ""}
            {priority || "normal"}
        </span>
    );
}
