export interface ServiceItem {
    label: string;
    cost: string;
}

export interface ServicesTableProps {
    heading: string;
    items: ServiceItem[];
    className?: string;
}
