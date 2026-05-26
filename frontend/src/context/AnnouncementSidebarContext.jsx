import { createContext, useState } from "react";

export const AnnouncementSidebarContext = createContext({
    isOpen: false,
    toggleSidebar: () => {},
    closeSidebar: () => {}
});

export function AnnouncementSidebarProvider({ children }) {
    const [isOpen, setIsOpen] = useState(false);

    const toggleSidebar = () => {
        setIsOpen((prev) => !prev);
    };

    const closeSidebar = () => {
        setIsOpen(false);
    };

    return (
        <AnnouncementSidebarContext.Provider value={{ isOpen, toggleSidebar, closeSidebar }}>
            {children}
        </AnnouncementSidebarContext.Provider>
    );
}
