require('dotenv').config();
const { Client } = require("basic-ftp");
const stream = require('stream');
const { Readable } = require('stream');

async function checkForTextInFTP(searchText) {
    const client = new Client();
    client.ftp.verbose = false; // Canviar a true per a debug

    try {
        await client.access({
            host: process.env.FTP_HOST,
            user: process.env.FTP_USER,
            password: process.env.FTP_PASSWORD,
            secure: false, // Canviar a true si es requereix una connexió segura
        });

        await client.cd(process.env.FTP_PATH);

/*
        // Esborrar el fitxer del servidor si existeix
        try {
            await client.remove('Recibo_detalle.csv');
            console.log('Fitxer existent esborrat del servidor.');
        } catch (error) {
            // Si el fitxer no existeix, capturem l'error i continuem
            console.log('El fitxer no existeix al servidor, continuem amb la pujada.');
        }
        // Generar contingut CSV
        const dades = [
            { num: 1, nombre: "Producte 1", precio: 100, pesado: 1 },
            { num: 2, nombre: "Producte 2", precio: 230, pesado: 1 },
            // Afegeix més objectes aquí...
        ];
        const capcalera = 'num,nombre,precio,pesado\n';
        let csvContent = dades.reduce((acc, {num, nombre, precio, pesado}) => 
            acc += `${num},${nombre},${precio},${pesado}\n`, capcalera);

        // Crear un stream llegible a partir del contingut CSV
        const csvStream = new Readable();
        csvStream.push(csvContent); // Afegir contingut al stream
        csvStream.push(null); // No més dades

        // Pujar el contingut CSV al servidor com a fitxer
//        await client.uploadFrom(csvStream, 'Recibo_detalle.csv');
//        console.log('Fitxer CSV generat i pujat amb èxit.');
*/       
        const fileList = await client.list();
        process.stdout.write('.')
        for (const file of fileList) {
            if (file.type === 1 && file.name=='Recibo_detalle.csv') { // És un fitxer (no un directori)
                const passThrough = new stream.PassThrough();
                await client.downloadTo(passThrough, 'Recibo_detalle.csv');
                await client.downloadTo('Recibo_detalle.csv', 'Recibo_detalle.csv');
console.log('hora: ', new Date().toLocaleTimeString(), "Descarregat: " , file.name, 'tamaño: ', file.size, 'bytes')                
                let content = '';
                passThrough.on('data', (chunk) => {
                    content += chunk.toString();
                });
                passThrough.on('end', () => {
//                console.log("Contingut: ", content)
                  if (content.includes(searchText)) {
                        console.log("Trobat !!");
                        // No fem return aquí perquè estem dins d'un event listener
                    }
                });
                await client.remove('PLULISTADESCARGA_Dwn.csv'); 
            }
        }
        
    } catch (error) {
        console.error("Hi ha hagut un error:", error);
    } finally {
        client.close();
    }
}

// Repetir la funció cada 3 segons
setInterval(() => {
    checkForTextInFTP("pastanaga");
}, 3000);



