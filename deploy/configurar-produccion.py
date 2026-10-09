#!/usr/bin/env python3
"""One-time setup: keep runtime production configuration outside Git."""
import getpass, json, os, pwd, subprocess, sys, tempfile
from pathlib import Path
ROOT = Path('/opt/tecnicos/config')
PROJECT = Path('/opt/tecnicos/Servicio-Tecnico')

def inspect(name):
    return json.loads(subprocess.check_output(['docker','inspect',name], text=True))[0]

def main():
    if os.geteuid() != 0:
        raise RuntimeError('Ejecuta con sudo python3 deploy/configurar-produccion.py')
    owner = pwd.getpwnam(os.environ.get('SUDO_USER') or 'jabesinho')
    backend, frontend = inspect('tecnicos_backend'), inspect('tecnicos_frontend')
    labels = backend['Config']['Labels']
    project = labels['com.docker.compose.project']
    if labels['com.docker.compose.service'] != 'backend' or frontend['Config']['Labels']['com.docker.compose.service'] != 'frontend':
        raise RuntimeError('Los nombres de los servicios no coinciden. No se modificó nada.')
    if frontend['Config']['Labels']['com.docker.compose.project'] != project:
        raise RuntimeError('Backend y frontend pertenecen a proyectos diferentes.')
    if Path(labels['com.docker.compose.project.working_dir']) != PROJECT:
        raise RuntimeError('La carpeta Compose no coincide con el proyecto revisado.')
    if (ROOT/'compose.production.json').exists():
        raise RuntimeError('La configuración externa ya existe. Se conserva; edítala con sudo nano si es necesario.')
    environment = dict(pair.split('=',1) for pair in backend['Config']['Env'])
    for key in ('PATH','HOSTNAME','HOME','PWD','SHLVL','NODE_VERSION','YARN_VERSION'):
        environment.pop(key,None)
    environment.update(SQLSERVER_HOST='190.157.145.197', SQLSERVER_ADDRESS='190.157.145.197',
        SQLSERVER_INSTANCE='WORLDOFFICE22', SQLSERVER_DATABASE='Melissa', SQLSERVER_USER='Externas',
        SQLSERVER_PORT='', SQLSERVER_ENCRYPT='false', SQLSERVER_TRUST_CERTIFICATE='true')
    password = getpass.getpass('Contraseña de Externas para World Office (oculta): ')
    if not password or any(c in password for c in '\r\n\x00'):
        raise RuntimeError('Contraseña vacía o inválida. No se modificó nada.')
    environment['SQLSERVER_PASSWORD'] = password
    # Compose interpolates $, including JSON files; $$ preserves literal secrets.
    configuration = {'services':{'backend':{'environment':{k:v.replace('$','$$') for k,v in environment.items()}}}}
    ROOT.mkdir(mode=0o700,parents=True,exist_ok=True)
    os.chmod(ROOT,0o700); os.chown(ROOT,owner.pw_uid,owner.pw_gid)
    fd, name = tempfile.mkstemp(prefix='.compose-',suffix='.json',dir=ROOT)
    try:
        with os.fdopen(fd,'w') as output: json.dump(configuration,output,indent=2)
        check = subprocess.run(['docker','compose','--project-directory',str(PROJECT),'-p',project,
            '-f',str(PROJECT/'docker-compose.prod.yml'),'-f',name,'config','--quiet'],capture_output=True)
        if check.returncode:
            raise RuntimeError('Compose rechazó la configuración. No se aplicaron cambios; revisa el Compose del proyecto.')
        destination = ROOT/'compose.production.json'
        os.chmod(name,0o600); os.chown(name,owner.pw_uid,owner.pw_gid)
        os.replace(name,destination)
        metadata = ROOT/'project-name'
        metadata.write_text(project+'\n'); os.chmod(metadata,0o600); os.chown(metadata,owner.pw_uid,owner.pw_gid)
    finally:
        if os.path.exists(name):os.unlink(name)
    print('OK: configuración guardada fuera de Git. El siguiente deploy la aplicará al backend.')
    print('Se conservaron las variables actuales de PostgreSQL y de la aplicación.')

if __name__ == '__main__':
    try:main()
    except Exception as error:
        print('ERROR:',str(error),file=sys.stderr);sys.exit(1)
