import os
import requests
import time
from sqlalchemy import create_engine, Column, String, Integer, Boolean, Text, ForeignKey, Date
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from datetime import datetime

Base = declarative_base()

class Company(Base):
    __tablename__ = 'oilgas_companies'
    id = Column(String, primary_key=True)
    name = Column(String)
    nit = Column(String)
    tagline = Column(Text)               # Descripción corta
    description = Column(Text)           # Acerca de (Descripción larga)
    logo_url = Column(String)            # URL del logo
    website = Column(String)
    phone = Column(String)
    headquarters_country = Column(String)
    incorporation_date = Column(Date)    # Fecha de Constitución
    total_employees = Column(Integer)
    legal_representative = Column(String)
    national_experience = Column(Integer)
    international_experience = Column(Integer)
    is_security_council_affiliate = Column(Boolean) # Afiliado al CCS
    is_authorized_economic_operator = Column(Boolean) # Operador Económico Autorizado
    updated_at = Column(String)

    # Relationships
    categories = relationship("CompanyCategory", back_populates="company", cascade="all, delete-orphan")
    subcategories = relationship("CompanySubcategory", back_populates="company", cascade="all, delete-orphan")
    clients = relationship("CompanyClient", back_populates="company", cascade="all, delete-orphan")
    services = relationship("CompanyService", back_populates="company", cascade="all, delete-orphan")
    ciiu_codes = relationship("CompanyCIIU", back_populates="company", cascade="all, delete-orphan")
    contacts = relationship("CompanyContact", back_populates="company", cascade="all, delete-orphan")
    offices = relationship("CompanyOffice", back_populates="company", cascade="all, delete-orphan")
    operations = relationship("CompanyOperation", back_populates="company", cascade="all, delete-orphan")
    social_networks = relationship("CompanySocialNetwork", back_populates="company", cascade="all, delete-orphan")

class CompanyCategory(Base):
    __tablename__ = 'oilgas_company_categories'
    id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(String, ForeignKey('oilgas_companies.id'))
    category_name = Column(String)

    company = relationship("Company", back_populates="categories")

class CompanySubcategory(Base):
    __tablename__ = 'oilgas_company_subcategories'
    id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(String, ForeignKey('oilgas_companies.id'))
    subcategory_name = Column(String)
    category_name = Column(String)

    company = relationship("Company", back_populates="subcategories")

class CompanyContact(Base):
    __tablename__ = 'oilgas_company_contacts'
    id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(String, ForeignKey('oilgas_companies.id'))
    name = Column(String)
    position = Column(String)
    phone = Column(String)
    email = Column(String)
    
    company = relationship("Company", back_populates="contacts")

class CompanyOffice(Base):
    __tablename__ = 'oilgas_company_offices'
    id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(String, ForeignKey('oilgas_companies.id'))
    office_type = Column(String)
    address = Column(String)
    city = Column(String)
    department = Column(String)
    country = Column(String)

    company = relationship("Company", back_populates="offices")

class CompanyOperation(Base):
    __tablename__ = 'oilgas_company_operations'
    id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(String, ForeignKey('oilgas_companies.id'))
    country_name = Column(String)

    company = relationship("Company", back_populates="operations")

class CompanySocialNetwork(Base):
    __tablename__ = 'oilgas_company_socials'
    id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(String, ForeignKey('oilgas_companies.id'))
    network_name = Column(String)
    url = Column(String)

    company = relationship("Company", back_populates="social_networks")

class CompanyClient(Base):
    __tablename__ = 'oilgas_company_clients'
    id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(String, ForeignKey('oilgas_companies.id'))
    client_name = Column(String)

    company = relationship("Company", back_populates="clients")

class CompanyService(Base):
    __tablename__ = 'oilgas_company_services'
    id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(String, ForeignKey('oilgas_companies.id'))
    service_name = Column(String)
    subcategory_name = Column(String)

    company = relationship("Company", back_populates="services")

class CompanyCIIU(Base):
    __tablename__ = 'oilgas_company_ciiu'
    id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(String, ForeignKey('oilgas_companies.id'))
    code = Column(String)
    description = Column(String)
    is_primary = Column(Boolean)

    company = relationship("Company", back_populates="ciiu_codes")

def parse_date(date_str):
    if not date_str:
        return None
    try:
        return datetime.strptime(date_str.split('T')[0], "%Y-%m-%d").date()
    except Exception:
        return None

def main():
    db_url = os.environ.get('DATABASE_URL', 'postgresql://postgres:REusFdvkAnx4O49NuRMqjzKpQwNfvCx47tuFxazGjJGx3gVacuuy4lEqXBseVfSx@localhost:5433/postgres')
    print(f"Connecting to database...")
    engine = create_engine(db_url)
    
    # Setup logo directory
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    logos_dir = os.path.join(base_dir, 'public', 'campetrol_logos')
    os.makedirs(logos_dir, exist_ok=True)

    
    # Create all tables
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()

    print("Fetching company list from Campetrol Directory...")
    list_url = 'https://api.directorio.campetrol.org/api/v1/public/directory/companies'
    resp = requests.get(list_url)
    resp.raise_for_status()
    companies = resp.json().get('data', [])
    print(f"Found {len(companies)} companies.")

    for i, comp in enumerate(companies):
        comp_id = comp['id']
        name = comp.get('basic_info', {}).get('name', 'Unknown')
        
        print(f"[{i+1}/{len(companies)}] Fetching profile for {name} ({comp_id})...")
        try:
            profile_resp = requests.get(f'{list_url}/{comp_id}')
            profile_resp.raise_for_status()
            data = profile_resp.json().get('data', {})
            
            basic = data.get('basic_info', {})
            info = data.get('company_info', {})
            logo_info = data.get('logo', {})

            # 1. Update or Create Company
            company = session.query(Company).filter_by(id=comp_id).first()
            if not company:
                company = Company(id=comp_id)
                session.add(company)
            
            company.name = basic.get('name')
            company.nit = basic.get('nit')
            company.tagline = basic.get('tagline')
            company.description = basic.get('about_us')
            
            # Download logo if available
            logo_url = logo_info.get('url') if isinstance(logo_info, dict) else None
            local_logo_path = None
            if logo_url:
                try:
                    ext = logo_url.split('.')[-1].split('?')[0]
                    if len(ext) > 4: ext = 'png'
                    filename = f"{comp_id}.{ext}"
                    filepath = os.path.join(logos_dir, filename)
                    
                    # Only download if we don't have it yet
                    if not os.path.exists(filepath):
                        img_data = requests.get(logo_url).content
                        with open(filepath, 'wb') as f:
                            f.write(img_data)
                    
                    local_logo_path = f"/campetrol_logos/{filename}"
                except Exception as e:
                    print(f"Failed to download logo for {name}: {e}")
            
            company.logo_url = local_logo_path
            
            company.website = basic.get('website')
            company.phone = info.get('phone')
            company.headquarters_country = info.get('headquarters_country_name')
            company.incorporation_date = parse_date(info.get('incorporation_date'))
            company.total_employees = info.get('total_employees')
            company.legal_representative = info.get('legal_representative')
            company.national_experience = info.get('national_experience')
            company.international_experience = info.get('international_experience')
            company.is_security_council_affiliate = info.get('is_security_council_affiliate')
            company.is_authorized_economic_operator = info.get('is_authorized_economic_operator')
            company.updated_at = data.get('updated_at')

            # Clear existing relations to avoid duplicates on update
            session.query(CompanyCategory).filter_by(company_id=comp_id).delete()
            session.query(CompanySubcategory).filter_by(company_id=comp_id).delete()
            session.query(CompanyClient).filter_by(company_id=comp_id).delete()
            session.query(CompanyService).filter_by(company_id=comp_id).delete()
            session.query(CompanyCIIU).filter_by(company_id=comp_id).delete()
            session.query(CompanyContact).filter_by(company_id=comp_id).delete()
            session.query(CompanyOffice).filter_by(company_id=comp_id).delete()
            session.query(CompanyOperation).filter_by(company_id=comp_id).delete()
            session.query(CompanySocialNetwork).filter_by(company_id=comp_id).delete()

            # 2. Add Categories
            for cat in data.get('categories', []):
                session.add(CompanyCategory(
                    company_id=comp_id,
                    category_name=cat.get('name')
                ))

            # 3. Add Subcategories
            for subcat in data.get('subcategories', []):
                session.add(CompanySubcategory(
                    company_id=comp_id,
                    subcategory_name=subcat.get('name'),
                    category_name=subcat.get('category_name')
                ))

            # 4. Add Clients
            for client in data.get('clients', []):
                session.add(CompanyClient(
                    company_id=comp_id,
                    client_name=client.get('client_name')
                ))

            # 5. Add Services
            for srv in data.get('services', []):
                session.add(CompanyService(
                    company_id=comp_id,
                    service_name=srv.get('service', {}).get('name'),
                    subcategory_name=srv.get('subcategory', {}).get('name')
                ))

            # 6. Add CIIU Codes
            for ciiu in data.get('ciiu_codes', []):
                session.add(CompanyCIIU(
                    company_id=comp_id,
                    code=ciiu.get('code'),
                    description=ciiu.get('description'),
                    is_primary=ciiu.get('is_primary')
                ))

            # 7. Add Contacts
            for contact in data.get('contact', []):
                session.add(CompanyContact(
                    company_id=comp_id,
                    name=contact.get('name'),
                    position=contact.get('position'),
                    phone=contact.get('phone'),
                    email=contact.get('email')
                ))

            # 8. Add Offices
            for office in data.get('offices', []):
                session.add(CompanyOffice(
                    company_id=comp_id,
                    office_type=office.get('office_type_name'),
                    address=office.get('address'),
                    city=office.get('city_name'),
                    department=office.get('department_name'),
                    country=office.get('country_name')
                ))

            # 9. Add Operations
            for op in data.get('operations', []):
                session.add(CompanyOperation(
                    company_id=comp_id,
                    country_name=op.get('country_name')
                ))

            # 10. Add Social Networks
            for social in data.get('social_networks', []):
                session.add(CompanySocialNetwork(
                    company_id=comp_id,
                    network_name=social.get('name'),
                    url=social.get('profile_url')
                ))

            session.commit()
            time.sleep(0.5)
            
        except Exception as e:
            print(f"Error fetching/saving {name}: {e}")
            session.rollback()

    print("Extraction complete! Data stored relationally.")

if __name__ == '__main__':
    main()
