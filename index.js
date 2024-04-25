require('dotenv').config();
const { Client } = require("basic-ftp");
const stream = require('stream');
const { Readable } = require('stream');
const fs = require('fs');
const readline = require('readline');
const { runSql } = require('./sqlService');
const { createObjectCsvWriter } = require('csv-writer');
const csvFilePath = './Recibo_detalle.csv';
const csvFilePath2 = './PLULISTADOWN.csv';

//let test = false;
let IP = process.env.FTP_HOST;
let nombreEmpresa;
let database = 'fac_demo'
let botigaDB = 0;
let iteracion = 0;
let MAXiteracion = 0;

async function checkForTextInFTP(searchText) {
    const client = new Client();
    client.ftp.verbose = false; // Canviar a true per a debug
    const llicenciaQ = `SELECT * from [Llicencies] where Tipus = 'ArviPeso';`;
    const resultLlicencia = await runSql(llicenciaQ, 'Hit');
    //console.log(`----------${IP}--------${database}----------${nombreEmpresa}-----------`)
    MAXiteracion = resultLlicencia.length - 1;
    if (resultLlicencia.length > 0) {
        IP = resultLlicencia[iteracion].IdExterna;
        nombreEmpresa = resultLlicencia[iteracion].Empresa;
        botigaDB = resultLlicencia[iteracion].Llicencia
    }
    const databaseQ = `select * from [web_empreses] where Nom = '${nombreEmpresa}'`;
    const resultDB = await runSql(databaseQ, 'Hit');
    if (resultDB.length > 0) {
        database = resultDB[0].Db;
    }
    //console.log(`----------${IP}--------${database}----------${nombreEmpresa}-----------`)
    try {

        await client.access({
            host: IP,
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


        // Obtener la fecha de hoy en formato "MM DD YYYY"
        const today = new Date();
        const mesActual = (today.getMonth() + 1).toString().padStart(2, "0"); // Obtiene el mes actual en formato de dos dígitos
        const añoActual = today.getFullYear().toString(); // Obtiene el año actual

        // Crear una interfaz de lectura de archivo
        const fileList = await client.list();
        process.stdout.write('.');
        for (const file of fileList) {
            if (file.type === 1 && file.name == 'Recibo_detalle.csv') { // És un fitxer (no un directori)
                const passThrough = new stream.PassThrough();
                //await client.downloadTo(passThrough, 'Recibo_detalle.csv');
                await client.downloadTo('Recibo_detalle.csv', 'Recibo_detalle.csv');
                await client.downloadTo('PLULISTADOWN.csv', 'PLULISTADOWN.csv');
                console.log('hora: ', new Date().toLocaleTimeString(), "Descarregat: ", file.name, 'tamaño: ', file.size, 'bytes')
                let content = '';
                passThrough.on('data', (chunk) => {
                    content += chunk.toString();
                });
                passThrough.on('end', () => {
                    //console.log("Contingut: ", content)
                    if (content.includes(searchText)) {
                        console.log("Trobat !!");
                        // No fem return aquí perquè estem dins d'un event listener
                    }
                });

                const rl = readline.createInterface({
                    input: fs.createReadStream(csvFilePath),
                    output: process.stdout,
                    terminal: false
                });

                let lineaActual = null; // Variable para almacenar la línea actual del archivo CSV
                const lines = [];

                // Evento que se dispara cuando se lee una línea
                rl.on('line', async (line) => {
                    lineaActual = line; // Almacenar la línea actual
                    lines.push(lineaActual)
                });


                // Evento que se dispara cuando se termina de leer el archivo
                rl.on('close', () => {
                    console.log('Lectura completa del archivo CSV.');
                    processLines(lines); //Leer todo el array
                });
            }

        }

    } catch (error) {
        console.error("Hi ha hagut un error:", error);
    } finally {

        client.close();
    }
    if (iteracion < MAXiteracion) {
        iteracion++;
    } else {
        iteracion = 0
    }

}

async function uploadFileToFTP(filePath) {
    const client = new Client();
    client.ftp.verbose = false; // Cambiar a true para depurar
    try {
        await client.access({
            host: IP,
            user: process.env.FTP_USER,
            password: process.env.FTP_PASSWORD,
            secure: false, // Canviar a true si es requereix una connexió segura
        });

        await client.cd(process.env.FTP_PATH);
        const ftpPath = process.env.FTP_PATH || "/opt/pcscale/files/csv"

        // Subir el archivo al servidor FTP
        await client.uploadFrom(filePath, `${ftpPath}/PLULISTAUP.csv`);
        console.log('Archivo subido con éxito al servidor FTP.');
    } catch (error) {
        console.error('Error al subir el archivo al servidor FTP:', error);
    } finally {
        client.close();
    }
}
// Consulta SQL para obtener los datos de la base de datos


// Función para ejecutar la consulta y escribir los resultados en un archivo CSV
async function exportToCsv() {
    try {
        const sqlQuery = `SELECT Codi as "num plu", SUBSTRING(NOM, LEN('Arvi ') + 1, LEN(NOM)) as "nombre", PREU as "precio", EsSumable as "pesado / no pesado", TipoIva as "IVA", Familia as "FAMILIA" FROM [articles] where LEFT(NOM, LEN('Arvi ')) = 'Arvi' order by Codi`;
        const result = await runSql(sqlQuery, database);

        // Configuración de las columnas del archivo CSV
        const csvWriter = createObjectCsvWriter({
            path: 'PLULISTAUP.csv',
            header: [
                { id: 'num plu', title: 'num plu' },
                { id: 'nombre', title: 'nombre' },
                { id: 'precio', title: 'precio' },
                { id: 'pesado / no pesado', title: 'pesado / no pesado' },
                { id: 'IVA', title: 'IVA' },
                { id: 'FAMILIA', title: 'FAMILIA' },
            ],
        });
        //console.log(result);
        for (let i = 0; i < result.length; i++) {
            // Ajustar el valor de 'pesado / no pesado'
            result[i]['pesado / no pesado'] = result[i]['pesado / no pesado'] ? 1 : 0;
            result[i]['precio'] *= 100
            //console.log(result[i]);
            await csvWriter.writeRecords([result[i]]);
        }
        console.log('Datos exportados correctamente a PLULISTAUP.csv');
    } catch (error) {
        console.error('Error al exportar datos:', error);
    }
}

let acumuladorLinea = '';

async function processLine(line, ultimoTicket) {
    const today = new Date();
    const mesActual = (today.getMonth() + 1).toString().padStart(2, "0");
    const añoActual = today.getFullYear().toString();
    let mes, dia, año, horas, minutos;
    // Verificar si la línea actual está vacía o es solo un salto de línea
    if (line.trim() === '') {
        // Si es solo un salto de línea, continuar con la siguiente línea
        return;
    }

    // Si hay acumulador, significa que estamos uniendo dos líneas
    if (acumuladorLinea !== '') {
        // Unir la línea actual con la acumulada
        line = acumuladorLinea + line;
        // Limpiar el acumulador
        acumuladorLinea = '';
    }

    // Verificar si la línea actual contiene un número impar de comillas
    // Esto indica que hay un salto de línea dentro de las comillas
    if ((line.match(/"/g) || []).length % 2 !== 0) {
        // Guardar el texto de la línea actual en el acumulador
        acumuladorLinea = line;
        // No procesar esta línea, esperar a la próxima
        return;
    }
    line = line.replace(/"\n"/g, ' ');
    const fields = line.split(',');

    // Obtener el valor del campo "DATA"
    const dataField = fields[0].trim();

    // Obtener el valor del campo "HORA"
    const horaField = fields[1].trim();

    // Convertir la hora a formato de hora típico
    let horaNormalizada = horaField;

    // Verificar la longitud de la cadena
    if (horaField.length === 3) {
        horas = horaField.substring(0, 1);
        minutos = horaField.substring(1);

        horaNormalizada = `${horas.padStart(2, '0')}:${minutos.padStart(2, '0')}`;
    } else if (horaField.length === 4) {
        horas = horaField.substring(0, 2);
        minutos = horaField.substring(2);

        horaNormalizada = `${horas}:${minutos.padStart(2, '0')}`;
    }

    const partes = dataField.split(" ");
    mes = partes[0].padStart(2, "0");
    dia = partes[1];
    año = partes[2];

    const num_tick = fields[2].trim();
    if (ultimoTicket < num_tick || ultimoTicket == '') {
        if (mes === mesActual && año === añoActual) {
            console.log('Línea :', line);
            const tabla = `[V_Venut_${año}-${mes}]`;
            const sqlQ = `SELECT top 1 * FROM ${tabla}`;
            try {
                const botiga = botigaDB;
                const dependenta = fields[8].trim();
                const plu = fields[3].trim();
                const quantitat = fields[5].trim();
                const importe = convertirNumero(fields[7].trim());
                const tipus_venta = 'V';
                const forma_marcar = '';
                const otros = '';
                const insertVenuts = `INSERT INTO ${tabla}(Botiga, Data, Dependenta, Num_tick, Estat, Plu, Quantitat, Import, Tipus_venta, FormaMarcar, Otros) VALUES('${botiga}', CONVERT(DATETIME, '${año}-${mes}-${dia} ${horas}:${minutos.padStart(2, '0')}', 120), '${dependenta}', '${num_tick}', '', '${plu}', ${quantitat}, ${importe}, '${tipus_venta}', '${forma_marcar}', '${otros}')`;
                await runSql(insertVenuts, database);
                existArticle(plu);
                if (num_tick > ultimoTicket)
                    ultimoTicket = num_tick;
                //console.log(`Records: ${año} ${mes} ${dia} ${horas} ${minutos}`)
                console.log("--------------------------------------------------------------------------");
            } catch (error) {
                console.error('Error al ejecutar el insert:', error);
            }
        }
    }
    return ultimoTicket
}

function convertirNumero(numero) {
    return parseFloat(numero) / 100;
}


async function processLines(lines) {
    console.log("-----------------------------------------------------------------------")
    const recordsQ = `SELECT * FROM [records] WHERE LEFT(concepte, LEN('${botigaDB} Ultimo ticket:')) = '${botigaDB} Ultimo ticket:'`;
    //console.log(recordsQ)
    const resultRecords = await runSql(recordsQ, database);
    //console.log(resultRecords);

    let ultimoTicket = '';
    if (resultRecords.length > 0) {
        const concepte = resultRecords[0].Concepte;
        ultimoTicket = parseInt(concepte.split(':')[1].trim());
    }
    //console.log(ultimoTicket);
    let i = 0
    for (const line of lines) {
        //console.log(++i); // Increment and log the index
        //++i;
        i = await processLine(line, ultimoTicket);
    }
    const recordText = `${botigaDB} Ultimo ticket: ${i}`;
    const records = `INSERT INTO [records] (TimeStamp, Concepte) VALUES(GETDATE(), '${recordText}')`;
    const updateRecord = `UPDATE [records] SET concepte = '${recordText}' WHERE LEFT(concepte, LEN('${botigaDB} Ultimo ticket:')) = '${botigaDB} Ultimo ticket:'`;
    //console.log(records)
    //console.log(updateRecord)

    if (i != ultimoTicket) {
        if (resultRecords.length < 1) {
            await runSql(records, database);
            console.log(`Se insertó el registro: '${recordText}'`);
        } else {
            await runSql(updateRecord, database);
            console.log(`Se actualizó el registro existente: '${recordText}'`);
        }
    }
    const sqlEnviar = `SELECT Tipus FROM [missatgesaenviar] WHERE Tipus = 'Articles'`;
    const deleteEnviar = `DELETE FROM missatgesaenviar WHERE Tipus = 'Articles'`;
    const resultEnviar = await runSql(sqlEnviar, database)
    exportToCsv();
    if (resultEnviar.length > 0) {
        
        uploadFileToFTP('PLULISTAUP.csv')
        runSql(deleteEnviar, database);
    }

}

async function existArticle(numeroPlu) {
    const rl2 = readline.createInterface({
        input: fs.createReadStream(csvFilePath2),
        output: process.stdout,
        terminal: false
    });
    const articles = [];

    rl2.on('line', async (line) => {
        //articles.push(line);
        const fields = line.split(',');
        if (fields[0].trim() == numeroPlu) {
            console.log(line)
            const Codi = fields[0].trim();
            const NOM = 'Arvi ' + fields[1].trim();
            const PREU = convertirNumero(fields[2].trim());
            const PreuMajor = convertirNumero(fields[2].trim());
            const Desconte = 0;
            const EsSumable = fields[3].trim();
            const Familia = fields[5].trim();
            const TipoIva = fields[4].trim();
            const NoDescontesEspecials = 0;
            const recordsQ = `SELECT * FROM [articles] WHERE Codi = ${numeroPlu}`;
            //console.log(recordsQ)
            const resultRecords = await runSql(recordsQ, database);
            //console.log(resultRecords);
            const article = `INSERT INTO [articles] (Codi, NOM, PREU, PreuMajor, Desconte, EsSumable, Familia, CodiGenetic, TipoIva, NoDescontesEspecials) 
            VALUES('${Codi}', '${NOM}', '${PREU}', '${PreuMajor}', '${Desconte}', '${EsSumable}', '${Familia}', '${Codi}', '${TipoIva}', '${NoDescontesEspecials}')`;
            const updateArticle = `UPDATE [articles] SET NOM = '${NOM}', PREU = '${PREU}', PreuMajor = '${PreuMajor}', Desconte = '${Desconte}', EsSumable = '${EsSumable}', Familia = '${Familia}', CodiGenetic = '${Codi}', TipoIva = '${TipoIva}', NoDescontesEspecials = '${NoDescontesEspecials}' WHERE Codi = '${Codi}'`;
            if (resultRecords.length < 1) {
                await runSql(article, database);
                console.log(`Se insertó un articulo`);
            } else {
                await runSql(updateArticle, database);
                console.log(`Se actualizó el articulo existente`);
            }
            return;
        }
    });

    rl2.on('close', () => {
        console.log('Lectura completa del archivo CSV PLULISTADOWN.');
    });
    console.log()
}


// Repetir la funció cada 10 segons
setInterval(async () => {
    await checkForTextInFTP("pastanaga");
}, 15000);