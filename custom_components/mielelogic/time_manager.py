# VERSION = "1.5.1"
"""Manage time slots for vaskehus."""
import logging
from datetime import datetime
from typing import List, Dict
from homeassistant.config_entries import ConfigEntry

_LOGGER = logging.getLogger(__name__)

# Default slots
DEFAULT_KLATVASK_SLOTS = [
    {"start": "07:00", "end": "09:00"},
    {"start": "09:00", "end": "11:00"},
    {"start": "11:00", "end": "13:00"},
    {"start": "13:00", "end": "15:00"},
    {"start": "15:00", "end": "17:00"},
    {"start": "17:00", "end": "19:00"},
    {"start": "19:00", "end": "21:00"},
]

DEFAULT_STORVASK_SLOTS = [
    {"start": "07:00", "end": "09:00"},
    {"start": "09:00", "end": "12:00"},
    {"start": "12:00", "end": "14:00"},
    {"start": "14:00", "end": "17:00"},
    {"start": "17:00", "end": "19:00"},
    {"start": "19:00", "end": "21:00"},
]


class TimeSlotManager:
    """Manage time slots for each vaskehus."""
    
    def __init__(self, config_entry: ConfigEntry):
        """Initialize time slot manager."""
        self.config_entry = config_entry
    
    def get_slots(self, vaskehus: str) -> List[Dict[str, any]]:
        """Get formatted time slots for vaskehus.
        
        Args:
            vaskehus: "Klatvask" or "Storvask"
        
        Returns:
            List of dicts with:
            - start: "07:00"
            - end: "09:00"
            - duration: 120 (minutes)
            - label: "07:00-09:00 (2t)"
        """
        # Get raw slots from config
        slot_key = f"{vaskehus.lower()}_slots"
        raw_slots = self.config_entry.data.get(
            slot_key,
            DEFAULT_KLATVASK_SLOTS if vaskehus == "Klatvask" else DEFAULT_STORVASK_SLOTS
        )
        
        # Format each slot
        formatted = []
        for slot in raw_slots:
            duration = self._calculate_duration(slot["start"], slot["end"])
            label = self._format_label(slot["start"], slot["end"], duration)
            
            formatted.append({
                "start": slot["start"],
                "end": slot["end"],
                "duration": duration,
                "label": label,
            })
        
        _LOGGER.debug(
            "📊 Loaded %d slots for %s",
            len(formatted),
            vaskehus,
        )
        
        return formatted
    
    def _calculate_duration(self, start: str, end: str) -> int:
        """Calculate duration in minutes."""
        start_dt = datetime.strptime(start, "%H:%M")
        end_dt = datetime.strptime(end, "%H:%M")
        return int((end_dt - start_dt).total_seconds() / 60)
    
    def _format_label(self, start: str, end: str, duration: int) -> str:
        """Format slot label: '07:00-09:00 (2t)'"""
        hours = duration // 60
        minutes = duration % 60
        
        if minutes == 0:
            duration_str = f"{hours}t"
        else:
            duration_str = f"{hours}t {minutes}min"
        
        return f"{start}-{end} ({duration_str})"
    
    def get_machine_for_vaskehus(self, vaskehus: str) -> int:
        """Get primary machine number for vaskehus."""
        if vaskehus == "Klatvask":
            return self.config_entry.data.get("klatvask_primary_machine", 1)
        else:
            return self.config_entry.data.get("storvask_primary_machine", 4)
    
    def get_vaskehus_for_machine(self, machine_number: int) -> str:
        """Get vaskehus name from machine number."""
        klatvask_machine = self.config_entry.data.get("klatvask_primary_machine", 1)
        storvask_machine = self.config_entry.data.get("storvask_primary_machine", 4)
        
        if machine_number == klatvask_machine:
            return "Klatvask"
        elif machine_number == storvask_machine:
            return "Storvask"
        else:
            return f"Maskine {machine_number}"
