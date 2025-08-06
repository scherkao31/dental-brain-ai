import os
import json
import uuid
from datetime import datetime
from typing import List, Dict, Optional, Any

class DataService:
    def __init__(self, data_dir: str):
        self.data_dir = data_dir
        
        # Verify data directory exists
        if not os.path.exists(data_dir):
            raise ValueError(f"Data directory not found: {data_dir}")
            
        self.categories = {
            'clinical_cases': {
                'name': 'Cas Cliniques',
                'description': 'Cas cliniques réels avec traitements',
                'icon': 'fa-clipboard-medical',
                'path': 'TRAITEMENTS_JSON',
                'file_pattern': 'treatment_planning_*.json'
            },
            'ideal_sequences': {
                'name': 'Séquences Idéales',
                'description': 'Protocoles de traitement optimaux',
                'icon': 'fa-list-check',
                'path': 'IDEAL_SEQUENCES_ENHANCED',
                'file_pattern': 'ideal_sequence_*.json'
            },
            'dental_knowledge': {
                'name': 'Connaissances Dentaires',
                'description': 'Principes et protocoles cliniques',
                'icon': 'fa-book-medical',
                'path': 'DENTAL_KNOWLEDGE',
                'file_pattern': '*.json'
            },
            'enhanced_knowledge': {
                'name': 'Base de Connaissances',
                'description': 'Base de connaissances enrichie',
                'icon': 'fa-brain',
                'path': 'ENHANCED_KNOWLEDGE',
                'file_pattern': '*.json'
            }
        }

    def get_categories(self) -> List[Dict[str, Any]]:
        """Get all available categories with their metadata"""
        categories_list = []
        
        import logging
        logger = logging.getLogger(__name__)
        
        for key, info in self.categories.items():
            category_path = os.path.join(self.data_dir, info['path'])
            
            if os.path.exists(category_path):
                try:
                    # Count items in category
                    files = os.listdir(category_path)
                    item_count = len([f for f in files 
                                    if f.endswith('.json') and not f.startswith('_')])
                    
                    categories_list.append({
                        'key': key,  # Changed from 'id' to 'key' to match what the logging expects
                        'id': key,   # Keep 'id' for backwards compatibility
                        'name': info['name'],
                        'description': info['description'],
                        'icon': info['icon'],
                        'item_count': item_count
                    })
                except Exception as e:
                    # Log error but continue with other categories
                    logger.error(f"Error reading category {key} at path {category_path}: {e}")
            else:
                logger.warning(f"Category path does not exist: {category_path}")
        
        return categories_list

    def get_items_by_category(self, category: str) -> List[Dict[str, Any]]:
        """Get all items in a specific category"""
        if category not in self.categories:
            raise ValueError(f"Invalid category: {category}")
        
        category_info = self.categories[category]
        category_path = os.path.join(self.data_dir, category_info['path'])
        
        items = []
        if os.path.exists(category_path):
            for filename in sorted(os.listdir(category_path)):
                if filename.endswith('.json') and not filename.startswith('_'):
                    file_path = os.path.join(category_path, filename)
                    try:
                        with open(file_path, 'r', encoding='utf-8') as f:
                            data = json.load(f)
                            
                        # Extract summary info based on category
                        item_summary = self._extract_item_summary(category, data, filename)
                        item_summary['id'] = filename.replace('.json', '')
                        item_summary['filename'] = filename
                        items.append(item_summary)
                    except Exception as e:
                        print(f"Error reading {file_path}: {e}")
        
        return items

    def get_item(self, category: str, item_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific item by category and ID"""
        if category not in self.categories:
            raise ValueError(f"Invalid category: {category}")
        
        category_info = self.categories[category]
        category_path = os.path.join(self.data_dir, category_info['path'])
        file_path = os.path.join(category_path, f"{item_id}.json")
        
        if os.path.exists(file_path):
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                # Add metadata
                data['_metadata'] = {
                    'id': item_id,
                    'category': category,
                    'filename': f"{item_id}.json",
                    'last_modified': datetime.fromtimestamp(
                        os.path.getmtime(file_path)
                    ).isoformat()
                }
                
                return data
            except Exception as e:
                print(f"Error reading {file_path}: {e}")
        
        return None

    def update_item(self, category: str, item_id: str, data: Dict[str, Any]) -> bool:
        """Update an existing item"""
        if category not in self.categories:
            raise ValueError(f"Invalid category: {category}")
        
        category_info = self.categories[category]
        category_path = os.path.join(self.data_dir, category_info['path'])
        file_path = os.path.join(category_path, f"{item_id}.json")
        
        if not os.path.exists(file_path):
            return False
        
        try:
            # Remove metadata if present
            if '_metadata' in data:
                del data['_metadata']
            
            # Add update timestamp
            data['last_updated'] = datetime.now().isoformat()
            
            # Write updated data
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            
            return True
        except Exception as e:
            print(f"Error updating {file_path}: {e}")
            return False

    def create_item(self, category: str, data: Dict[str, Any]) -> Optional[str]:
        """Create a new item in a category"""
        if category not in self.categories:
            raise ValueError(f"Invalid category: {category}")
        
        category_info = self.categories[category]
        category_path = os.path.join(self.data_dir, category_info['path'])
        
        # Ensure directory exists
        os.makedirs(category_path, exist_ok=True)
        
        try:
            # Generate ID based on category
            item_id = self._generate_item_id(category, category_path)
            
            # Add creation timestamp
            data['created_at'] = datetime.now().isoformat()
            
            # Write data
            file_path = os.path.join(category_path, f"{item_id}.json")
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            
            return item_id
        except Exception as e:
            print(f"Error creating item: {e}")
            return None

    def delete_item(self, category: str, item_id: str) -> bool:
        """Delete an item"""
        if category not in self.categories:
            raise ValueError(f"Invalid category: {category}")
        
        category_info = self.categories[category]
        category_path = os.path.join(self.data_dir, category_info['path'])
        file_path = os.path.join(category_path, f"{item_id}.json")
        
        if os.path.exists(file_path):
            try:
                # Create backup before deletion
                backup_path = file_path + '.backup'
                os.rename(file_path, backup_path)
                return True
            except Exception as e:
                print(f"Error deleting {file_path}: {e}")
                return False
        
        return False

    def search_items(self, query: str, category: Optional[str] = None) -> List[Dict[str, Any]]:
        """Search items across categories"""
        query_lower = query.lower()
        results = []
        
        categories_to_search = [category] if category else self.categories.keys()
        
        for cat in categories_to_search:
            if cat not in self.categories:
                continue
                
            items = self.get_items_by_category(cat)
            for item in items:
                # Search in title and description
                if (query_lower in item.get('title', '').lower() or 
                    query_lower in item.get('description', '').lower() or
                    query_lower in item.get('treatment_type', '').lower()):
                    
                    item['category'] = cat
                    item['category_name'] = self.categories[cat]['name']
                    results.append(item)
        
        return results

    def _extract_item_summary(self, category: str, data: Dict[str, Any], filename: str) -> Dict[str, Any]:
        """Extract summary information based on category type"""
        summary = {
            'title': 'Sans titre',
            'description': '',
            'tags': []
        }
        
        if category == 'clinical_cases':
            summary['title'] = data.get('case_title', filename.replace('.json', ''))
            summary['description'] = data.get('case_description', '')
            summary['patient_age'] = data.get('patient_age', '')
            summary['treatment_type'] = data.get('treatment_type', '')
            summary['tags'] = data.get('keywords', [])
            
        elif category == 'ideal_sequences':
            summary['title'] = data.get('procedure_name', filename.replace('.json', ''))
            summary['description'] = data.get('description', '')
            summary['duration'] = data.get('total_duration', '')
            summary['tooth_notation'] = data.get('tooth_notation', '')
            summary['tags'] = data.get('keywords', [])
            
        elif category == 'dental_knowledge':
            if 'title' in data:
                summary['title'] = data['title']
            elif 'topics' in data and isinstance(data['topics'], list) and len(data['topics']) > 0:
                summary['title'] = data['topics'][0].get('title', filename.replace('.json', ''))
            
            summary['description'] = self._extract_first_content(data)
            
        elif category == 'enhanced_knowledge':
            if isinstance(data, list) and len(data) > 0:
                summary['title'] = data[0].get('title', filename.replace('.json', ''))
                summary['description'] = data[0].get('content', '')[:200] + '...' if data[0].get('content') else ''
            else:
                summary['title'] = data.get('title', filename.replace('.json', ''))
                summary['description'] = str(data)[:200] + '...'
        
        return summary

    def _extract_first_content(self, data: Any) -> str:
        """Extract first meaningful content from nested data structures"""
        if isinstance(data, dict):
            if 'content' in data:
                return data['content'][:200] + '...' if len(data['content']) > 200 else data['content']
            elif 'topics' in data and isinstance(data['topics'], list):
                for topic in data['topics']:
                    if 'content' in topic:
                        return topic['content'][:200] + '...' if len(topic['content']) > 200 else topic['content']
        
        return ''

    def _generate_item_id(self, category: str, category_path: str) -> str:
        """Generate a unique ID for a new item"""
        if category == 'clinical_cases':
            # Find the highest number
            max_num = 0
            for filename in os.listdir(category_path):
                if filename.startswith('treatment_planning_') and filename.endswith('.json'):
                    try:
                        num = int(filename.replace('treatment_planning_', '').replace('.json', ''))
                        max_num = max(max_num, num)
                    except:
                        pass
            return f"treatment_planning_{max_num + 1}"
        
        elif category == 'ideal_sequences':
            # Use timestamp for ideal sequences
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            return f"ideal_sequence_custom_{timestamp}"
        
        else:
            # Use UUID for other categories
            return f"custom_{uuid.uuid4().hex[:8]}"